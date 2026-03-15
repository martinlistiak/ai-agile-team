import { useEffect, useRef, useState, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { getSocket } from "@/lib/socket";

interface FileChangeEvent {
  executionId: string;
  filePath: string;
  content: string;
  diff: { additions: number[]; deletions: number[] };
}

const EXT_LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  json: "json",
  html: "html",
  css: "css",
};

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANGUAGE_MAP[ext] ?? "plaintext";
}

interface MonacoCodeViewerProps {
  agentId: string;
  isLive: boolean;
}

export function MonacoCodeViewer({ agentId, isLive }: MonacoCodeViewerProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(
    null,
  );
  const [fileData, setFileData] = useState<FileChangeEvent | null>(null);

  const applyDecorations = useCallback((diff: FileChangeEvent["diff"]) => {
    const ed = editorRef.current;
    if (!ed) return;

    const decorations: editor.IModelDeltaDecoration[] = [];

    for (const line of diff.additions) {
      decorations.push({
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: "monaco-diff-addition",
          glyphMarginClassName: "monaco-diff-addition-glyph",
        },
      });
    }

    for (const line of diff.deletions) {
      decorations.push({
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: "monaco-diff-deletion",
          glyphMarginClassName: "monaco-diff-deletion-glyph",
        },
      });
    }

    if (decorationsRef.current) {
      decorationsRef.current.clear();
    }
    decorationsRef.current = ed.createDecorationsCollection(decorations);
  }, []);

  const handleEditorMount: OnMount = useCallback(
    (editor) => {
      editorRef.current = editor;
      if (fileData?.diff) {
        applyDecorations(fileData.diff);
      }
    },
    [fileData, applyDecorations],
  );

  // Subscribe to file_change WebSocket events
  useEffect(() => {
    const socket = getSocket();

    const handleFileChange = (event: FileChangeEvent) => {
      setFileData(event);
      // Apply decorations after content updates
      setTimeout(() => applyDecorations(event.diff), 50);
    };

    socket.on("file_change", handleFileChange);
    return () => {
      socket.off("file_change", handleFileChange);
    };
  }, [agentId, applyDecorations]);

  if (!fileData) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-800 rounded-lg">
        {isLive ? "Waiting for file changes…" : "No file changes recorded"}
      </div>
    );
  }

  const language = detectLanguage(fileData.filePath);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate">
          {fileData.filePath}
        </span>
        <span className="ml-auto text-[10px] text-gray-400 uppercase">
          {language}
        </span>
      </div>
      <Editor
        height="300px"
        language={language}
        value={fileData.content}
        onMount={handleEditorMount}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: "on",
          glyphMargin: true,
          folding: false,
          fontSize: 12,
          domReadOnly: true,
          renderLineHighlight: "none",
        }}
        theme="vs-dark"
      />
    </div>
  );
}
