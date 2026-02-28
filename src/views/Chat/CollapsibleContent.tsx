import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CollapsibleContentProps {
  content: string;
  markdown: boolean;
}

export function CollapsibleContent({ content, markdown }: CollapsibleContentProps) {
  return (
    <div className="text-ink text-sm leading-relaxed">
      <div>
        {markdown ? (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-table:my-2 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-code:before:content-none prose-code:after:content-none">
            <Markdown remarkPlugins={[remarkGfm]}>
              {content}
            </Markdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        )}
      </div>
    </div>
  );
}
