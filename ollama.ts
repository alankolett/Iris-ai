import axios from 'axios';

export async function streamOllamaChat(
  baseUrl: string,
  model: string,
  message: string,
  history: any[],
  onChunk: (text: string) => void
) {
  const formattedHistory = history.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  formattedHistory.push({ role: 'user', content: message });

  const response = await axios({
    method: 'post',
    url: `${baseUrl}/api/chat`,
    data: {
      model: model,
      messages: formattedHistory,
      stream: true
    },
    responseType: 'stream'
  });

  return new Promise<void>((resolve, reject) => {
    response.data.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            onChunk(parsed.message.content);
          }
        } catch {
          // Ignore partial or malformed chunk splits
        }
      }
    });

    response.data.on('end', () => resolve());
    response.data.on('error', (err: Error) => reject(err));
  });
}
