import { useEffect, useRef } from "react";
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
} from "@milkdown/core";
import {
  Milkdown,
  MilkdownProvider,
  useEditor,
  useInstance,
} from "@milkdown/react";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { upload, uploadConfig } from "@milkdown/plugin-upload";
import { nord } from "@milkdown/theme-nord";
import type { Node } from "@milkdown/prose/model";
import api from "@/api/client";

interface RichTextEditorProps {
  content: string;
  onChange?: (markdown: string) => void;
  readonly?: boolean;
  placeholder?: string;
}

const imageUploader = async (
  files: FileList,
  schema: ReturnType<typeof Object>,
) => {
  const nodes: Node[] = [];

  for (const file of Array.from(files)) {
    if (!file.type.startsWith("image/")) continue;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const url = response.data.url;
      const alt = file.name;
      const node = schema.nodes.image.createAndFill({ src: url, alt }) as Node;
      if (node) nodes.push(node);
    } catch {
      console.error("Image upload failed");
    }
  }

  return nodes;
};

function MilkdownEditor({
  content,
  onChange,
  readonly = false,
  placeholder,
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialContentRef = useRef(content);
  const placeholderRef = useRef(placeholder);
  placeholderRef.current = placeholder;

  useEditor((root) => {
    const editor = Editor.make()
      .config(nord)
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialContentRef.current);

        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          onChangeRef.current?.(markdown);
          // toggle empty state for placeholder CSS
          if (placeholderRef.current) {
            try {
              const view = _ctx.get(editorViewCtx);
              if (view?.dom) {
                view.dom.dataset.empty = markdown.trim() === "" ? "true" : "";
              }
            } catch {
              // ignore
            }
          }
        });

        ctx.set(uploadConfig.key, {
          uploader: imageUploader as any,
          enableHtmlFileUploader: false,
          uploadWidgetFactory: () => null as any,
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(upload);

    return editor;
  }, []);

  const [loading, getInstance] = useInstance();

  useEffect(() => {
    if (loading) return;
    const editor = getInstance();
    if (!editor) return;

    try {
      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      if (view && view.dom) {
        view.dom.contentEditable = readonly ? "false" : "true";
        if (placeholder) {
          view.dom.dataset.placeholder = placeholder;
          // set initial empty state
          const text = view.state.doc.textContent;
          view.dom.dataset.empty = text.trim() === "" ? "true" : "";

          // sync empty state on every DOM input (fires synchronously, no delay)
          const onInput = () => {
            const docText = view.state.doc.textContent;
            view.dom.dataset.empty = docText.trim() === "" ? "true" : "";
          };
          view.dom.addEventListener("input", onInput);
          return () => view.dom.removeEventListener("input", onInput);
        }
      }
    } catch {
      // Editor may not be fully initialized yet
    }
  }, [loading, readonly, getInstance, placeholder]);

  return <Milkdown />;
}

export function RichTextEditor(props: RichTextEditorProps) {
  return (
    <MilkdownProvider>
      <div
        className={`prose dark:prose-invert max-w-none ${props.readonly ? "pointer-events-none opacity-80" : ""}`}
      >
        <MilkdownEditor {...props} />
      </div>
    </MilkdownProvider>
  );
}
