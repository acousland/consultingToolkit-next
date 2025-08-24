/**
 * Creates a streaming JSON response that allows sending multiple JSON objects
 * over a single HTTP response stream. Useful for progress updates and real-time data.
 */
export function streamingJsonResponse(
  generator: () => AsyncGenerator<any, void, unknown>
): Response {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator()) {
          const data = JSON.stringify(chunk) + '\n';
          try {
            controller.enqueue(encoder.encode(data));
          } catch (error) {
            // Controller might be closed if client disconnected
            console.warn('Stream controller closed, stopping generation');
            break;
          }
        }
      } catch (error) {
        console.error('Streaming error:', error);
        try {
          const errorData = JSON.stringify({ 
            type: 'error', 
            message: error instanceof Error ? error.message : 'Stream failed' 
          }) + '\n';
          controller.enqueue(encoder.encode(errorData));
        } catch (controllerError) {
          // Controller already closed, nothing we can do
          console.warn('Could not send error to closed controller');
        }
      } finally {
        try {
          controller.close();
        } catch (error) {
          // Controller might already be closed
          console.warn('Controller already closed');
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Reads a streaming JSON response line by line, parsing each JSON object
 */
export async function* readStreamingJson(response: Response): AsyncGenerator<any, void, unknown> {
  if (!response.body) {
    throw new Error('Response body is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            yield JSON.parse(line);
          } catch (error) {
            console.error('Failed to parse JSON line:', line, error);
          }
        }
      }
    }
    
    // Process any remaining data in buffer
    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer);
      } catch (error) {
        console.error('Failed to parse final JSON:', buffer, error);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
