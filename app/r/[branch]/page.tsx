import { notFound } from "next/navigation";

import { readDesignPass } from "@/lib/store";

export default async function DesignPassPage({
  params,
}: {
  params: Promise<{ branch: string }>;
}) {
  const { branch } = await params;
  const pass = await readDesignPass(branch);

  if (!pass) notFound();

  return (
    <article className="prose prose-sm max-w-none prose-invert">
      <DesignPassMarkdown body={pass.body} />
    </article>
  );
}

function DesignPassMarkdown({ body }: { body: string }) {
  const blocks: React.ReactNode[] = [];
  const sections = body.split(/\n(?=## )/);

  sections.forEach((section, idx) => {
    const lines = section.split("\n");
    const headingLine = lines[0];
    const isH2 = headingLine.startsWith("## ");
    const isH1 = headingLine.startsWith("# ");
    const heading = isH2
      ? headingLine.slice(3)
      : isH1
        ? headingLine.slice(2)
        : null;
    const content = (heading ? lines.slice(1) : lines).join("\n").trim();

    if (heading && isH1) {
      blocks.push(
        <h1
          key={`h-${idx}`}
          className="text-2xl font-bold tracking-tight mb-4"
        >
          {heading}
        </h1>,
      );
    } else if (heading) {
      blocks.push(
        <h2
          key={`h-${idx}`}
          className="mt-8 text-lg font-semibold tracking-tight border-b border-separator pb-2"
        >
          {heading}
        </h2>,
      );
    }

    if (content) {
      blocks.push(
        <div
          key={`c-${idx}`}
          className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85"
        >
          {content}
        </div>,
      );
    }
  });

  return <>{blocks}</>;
}
