import { GoogleGenAI, Type } from '@google/genai';
import { ipcMain } from 'electron';

// Tool definitions matching Phase 4 capabilities
const systemTools: any[] = [
  {
    functionDeclarations: [
      {
        name: 'openApp',
        description: 'Launches a system application by name (e.g., chrome, vscode, notepad, calculator).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            appName: { type: Type.STRING, description: 'The name or alias of the application.' }
          },
          required: ['appName']
        }
      },
      {
        name: 'runCommand',
        description: 'Executes a safe shell/terminal command and returns the combined stdout/stderr output.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            command: { type: Type.STRING, description: 'The shell command to execute.' },
            cwd: { type: Type.STRING, description: 'Optional current working directory.' }
          },
          required: ['command']
        }
      },
      {
        name: 'readDirectory',
        description: 'Lists all files and subdirectories inside a specific local target directory path.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: 'The absolute local file system directory path.' }
          },
          required: ['path']
        }
      },
      {
        name: 'readFile',
        description: 'Reads the text content of a local file. Files over 5MB are automatically rejected.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: 'The absolute path to the targeted file.' }
          },
          required: ['path']
        }
      },
      {
        name: 'writeFile',
        description: 'Writes text data or source code to a specific file path, automatically creating nested folders.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: 'The destination file path.' },
            content: { type: Type.STRING, description: 'The exact string content to write.' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'takeScreenshot',
        description: 'Captures the active display layout and saves it locally or captures it as raw image buffer data.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            savePath: { type: Type.STRING, description: 'Optional explicit local path to write the image file.' }
          }
        }
      },
      {
        name: 'getWeather',
        description: 'Retrieves localized live weather forecasts including temperature and ambient conditions.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            city: { type: Type.STRING, description: 'The name of the target city.' }
          },
          required: ['city']
        }
      }
    ]
  }
];

const SYSTEM_INSTRUCTION = `You are IRIS (Intelligent Reasoning and Integrated System), a premium, high-performance AI desktop assistant layer operating natively inside the user's Operating System.
You have direct authorization to manipulate the file system, run terminal configurations, open applications, capture screens, and fetch live data when explicitly requested.
Always deliver concise, execution-focused feedback. If a tool execution fails, explain the failure accurately and suggest alternatives. Keep your personality professional, responsive, and sharp.`;

export async function streamGeminiChat(
  apiKey: string,
  message: string,
  history: any[],
  onChunk: (text: string) => void,
  onToolCall: (name: string, args: any) => void
) {
  const ai = new GoogleGenAI({ apiKey });
  
  // Format history to match Google Gen AI format
  const contents = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));
  
  contents.push({ role: 'user', parts: [{ text: message }] });

  const responseStream = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: systemTools,
    }
  });

  let toolCallsToExecute: any[] = [];

  for await (const chunk of responseStream) {
    if (chunk.text) {
      onChunk(chunk.text);
    }
    if (chunk.functionCalls) {
      toolCallsToExecute = toolCallsToExecute.concat(chunk.functionCalls);
    }
  }

  // Handle function execution sequence if requested by the model
  for (const call of toolCallsToExecute) {
    onToolCall(call.name, call.args);
    
    // Map function calls safely back to internal IPC handler channels
    let ipcChannel = '';
    if (call.name === 'openApp') ipcChannel = 'open-app';
    if (call.name === 'runCommand') ipcChannel = 'run-command';
    if (call.name === 'readDirectory') ipcChannel = 'read-directory';
    if (call.name === 'readFile') ipcChannel = 'read-file';
    if (call.name === 'writeFile') ipcChannel = 'write-file';
    if (call.name === 'takeScreenshot') ipcChannel = 'take-screenshot';
    if (call.name === 'getWeather') ipcChannel = 'get-weather';

    if (ipcChannel) {
      let result;
      try {
        const handler = (ipcMain as any)._invokeHandlers.get(ipcChannel);
        if (handler) {
          result = await handler({} as any, call.args);
        } else {
          result = { error: "Handler not found" };
        }
      } catch (err: any) {
        result = { error: err.message };
      }
      
      // Feed execution outcome back to Gemini to complete the loop
      const followUp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          ...contents,
          { role: 'model', parts: [{ functionCall: call }] },
          { role: 'user', parts: [{ functionResponse: { name: call.name, response: result } }] }
        ],
        config: { systemInstruction: SYSTEM_INSTRUCTION }
      });

      if (followUp.text) {
        onChunk(followUp.text);
      }
    }
  }
}
