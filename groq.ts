import Groq from 'groq-sdk';
import { ipcMain } from 'electron';

// Tool definitions matching Phase 4 capabilities
const systemTools: Groq.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'openApp',
      description: 'Launches a system application by name (e.g., chrome, vscode, notepad, calculator).',
      parameters: {
        type: 'object',
        properties: {
          appName: { type: 'string', description: 'The name or alias of the application.' }
        },
        required: ['appName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'runCommand',
      description: 'Executes a safe shell/terminal command and returns the combined stdout/stderr output.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute.' },
          cwd: { type: 'string', description: 'Optional current working directory.' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'readDirectory',
      description: 'Lists all files and subdirectories inside a specific local target directory path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The absolute local file system directory path.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'readFile',
      description: 'Reads the text content of a local file. Files over 5MB are automatically rejected.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The absolute path to the targeted file.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'writeFile',
      description: 'Writes text data or source code to a specific file path, automatically creating nested folders.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The destination file path.' },
          content: { type: 'string', description: 'The exact string content to write.' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'takeScreenshot',
      description: 'Captures the active display layout and saves it locally or captures it as raw image buffer data.',
      parameters: {
        type: 'object',
        properties: {
          savePath: { type: 'string', description: 'Optional explicit local path to write the image file.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getWeather',
      description: 'Retrieves localized live weather forecasts including temperature and ambient conditions.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'The name of the target city.' }
        },
        required: ['city']
      }
    }
  }
];

const SYSTEM_INSTRUCTION = `You are IRIS (Intelligent Reasoning and Integrated System), a premium, high-performance AI desktop assistant layer operating natively inside the user's Operating System.
You have direct authorization to manipulate the file system, run terminal configurations, open applications, capture screens, and fetch live data when explicitly requested.
Always deliver concise, execution-focused feedback. If a tool execution fails, explain the failure accurately and suggest alternatives. Keep your personality professional, responsive, and sharp.`;

export async function streamGroqChat(
  apiKey: string,
  modelName: string,
  message: string,
  history: any[],
  onChunk: (text: string) => void,
  onToolCall: (name: string, args: any) => void
) {
  const groq = new Groq({ apiKey });

  // Format history for Groq (OpenAI-like format)
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...history.map(msg => {
      const role = msg.role === 'assistant' ? 'assistant' : msg.role === 'tool' ? 'tool' : 'user';
      const baseMsg: any = { role, content: msg.content };
      if (role === 'tool') {
        baseMsg.name = msg.toolName;
        baseMsg.tool_call_id = msg.toolCallId;
      }
      return baseMsg as Groq.Chat.ChatCompletionMessageParam;
    }),
    { role: 'user', content: message }
  ];

  let stream = await groq.chat.completions.create({
    messages,
    model: modelName,
    temperature: 0.5,
    max_tokens: 1024,
    top_p: 1,
    stream: true,
    tools: systemTools,
    tool_choice: 'auto'
  });

  let toolCallsToExecute: any[] = [];
  let toolCallChunks: any = {};

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    
    if (delta?.content) {
      onChunk(delta.content);
    }
    
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        if (!toolCallChunks[tc.index]) {
          toolCallChunks[tc.index] = { id: tc.id, name: tc.function?.name, args: tc.function?.arguments || '' };
        } else {
          toolCallChunks[tc.index].args += tc.function?.arguments || '';
        }
      }
    }
  }

  // Parse accumulated tool call strings into JSON
  for (const key of Object.keys(toolCallChunks)) {
    const tc = toolCallChunks[key];
    try {
      const args = JSON.parse(tc.args);
      toolCallsToExecute.push({
        id: tc.id,
        name: tc.name,
        args: args
      });
    } catch (e) {
      console.error("Failed to parse tool call arguments:", e);
    }
  }

  if (toolCallsToExecute.length > 0) {
    const assistantMessage: Groq.Chat.ChatCompletionAssistantMessageParam = {
      role: 'assistant',
      tool_calls: toolCallsToExecute.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.args) }
      }))
    };
    messages.push(assistantMessage);

    for (const call of toolCallsToExecute) {
      onToolCall(call.name, call.args);
      
      let ipcChannel = '';
      if (call.name === 'openApp') ipcChannel = 'open-app';
      if (call.name === 'runCommand') ipcChannel = 'run-command';
      if (call.name === 'readDirectory') ipcChannel = 'read-directory';
      if (call.name === 'readFile') ipcChannel = 'read-file';
      if (call.name === 'writeFile') ipcChannel = 'write-file';
      if (call.name === 'takeScreenshot') ipcChannel = 'take-screenshot';
      if (call.name === 'getWeather') ipcChannel = 'get-weather';

      let resultStr = '';
      if (ipcChannel) {
        try {
          const handler = (ipcMain as any)._invokeHandlers.get(ipcChannel);
          if (handler) {
            const result = await handler({} as any, call.args);
            resultStr = JSON.stringify(result);
          } else {
            resultStr = JSON.stringify({ error: "Handler not found for channel: " + ipcChannel });
          }
        } catch (err: any) {
          resultStr = JSON.stringify({ error: err.message });
        }
      } else {
        resultStr = JSON.stringify({ error: "Unknown tool name" });
      }

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: resultStr
      });
    }

    const followUpStream = await groq.chat.completions.create({
      messages,
      model: modelName,
      temperature: 0.5,
      stream: true,
      tools: systemTools
    });

    for await (const chunk of followUpStream) {
      if (chunk.choices[0]?.delta?.content) {
        onChunk(chunk.choices[0].delta.content);
      }
    }
  }
}
