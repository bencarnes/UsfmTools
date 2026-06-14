import type { RequestMessage, ResponseMessage } from "./protocol.js";
import { getDiagnostics } from "./diagnostics.js";
import { getCompletions } from "./completions.js";
import { classifyTokens, classifyTokensInRange } from "./classifier.js";

/**
 * USFM Language Service — async message-based API.
 *
 * Designed to run in the main thread or a Web Worker. Consumers send
 * request messages and receive response messages, similar to LSP.
 *
 * The service is stateless — each request includes the full document content.
 * This simplifies the protocol at the cost of sending more data per request.
 * For large documents (full books), a future enhancement could add incremental
 * document sync.
 */
export class UsfmLanguageService {
  /**
   * Handle an incoming request and return a response.
   */
  handleMessage(message: RequestMessage): ResponseMessage {
    switch (message.type) {
      case "validate":
        return {
          type: "validate",
          id: message.id,
          diagnostics: getDiagnostics(message.content),
        };

      case "complete":
        return {
          type: "complete",
          id: message.id,
          items: getCompletions(
            message.content,
            message.position.line,
            message.position.column,
          ),
        };

      case "classify":
        return {
          type: "classify",
          id: message.id,
          tokens: classifyTokens(message.content),
        };

      case "classifyRange":
        return {
          type: "classifyRange",
          id: message.id,
          tokens: classifyTokensInRange(message.content, message.from, message.to),
        };
    }
  }
}

/**
 * Create an async wrapper around the language service.
 * In the future this can be replaced with a Web Worker transport.
 */
export function createLanguageClient() {
  const service = new UsfmLanguageService();

  return {
    async validate(content: string) {
      const response = service.handleMessage({
        type: "validate",
        id: crypto.randomUUID(),
        content,
      });
      if (response.type === "validate") return response.diagnostics;
      return [];
    },

    async complete(content: string, line: number, column: number) {
      const response = service.handleMessage({
        type: "complete",
        id: crypto.randomUUID(),
        content,
        position: { line, column },
      });
      if (response.type === "complete") return response.items;
      return [];
    },

    async classify(content: string) {
      const response = service.handleMessage({
        type: "classify",
        id: crypto.randomUUID(),
        content,
      });
      if (response.type === "classify") return response.tokens;
      return [];
    },

    async classifyRange(content: string, from: number, to: number) {
      const response = service.handleMessage({
        type: "classifyRange",
        id: crypto.randomUUID(),
        content,
        from,
        to,
      });
      if (response.type === "classifyRange") return response.tokens;
      return [];
    },
  };
}
