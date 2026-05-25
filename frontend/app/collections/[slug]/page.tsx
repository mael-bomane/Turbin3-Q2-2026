import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { YouTube } from "@/components/YouTube";
import { SolanaStake } from "@/components/SolanaStake";
import { SolanaUsd } from "@/components/SolanaUsd";
import { compileMDX } from "next-mdx-remote/rsc";
import { Suspense } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import config from "@/config";

import type { Metadata } from "next";
import { Title } from "@/components/ui/title";

export async function generateStaticParams() {
  const files = fs.readdirSync(path.join(process.cwd(), "content"));

  return files.map((file) => ({
    slug: file.replace(/\.mdx$/, ""),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const filePath = path.join(process.cwd(), "content", `${slug}.mdx`);

  if (!fs.existsSync(filePath)) {
    notFound();
  }

  const source = fs.readFileSync(filePath, "utf8");

  const { frontmatter } = await compileMDX<{
    title: string;
    description?: string;
    date?: string;
  }>({
    source,
    options: {
      parseFrontmatter: true,
      mdxOptions: {
        remarkPlugins: [remarkMath, remarkGfm],
        // rehypePlugins: [rehypeKatex],
      },
    },
  });

  return {
    title: `${frontmatter.title || slug} by ${config.appName}`,
    description: frontmatter.description || "",
    openGraph: {
      title: `${frontmatter.title || slug} by ${config.appName}`,
      description: frontmatter.description || "",
      images: [
        {
          url: `/images/article/${slug}.png`, // adjust extension as needed
          alt: frontmatter.title || slug,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: frontmatter.title || slug,
      description: frontmatter.description || "",
      images: [`/images/article/${slug}.png`],
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const filePath = path.join(process.cwd(), "content", `${slug}.mdx`);

  if (!fs.existsSync(filePath)) {
    notFound();
  }

  const source = fs.readFileSync(filePath, "utf8");

  const { content, frontmatter } = await compileMDX<{
    title: string;
    description?: string;
    date?: string;
  }>({
    source,
    components: {
      YouTube,
      SolanaStake,
      SolanaUsd,
    },
    options: {
      parseFrontmatter: true,
      blockJS: false,
      mdxOptions: {
        remarkPlugins: [remarkMath, remarkGfm],
        rehypePlugins: [rehypeKatex],
      },
    },
  });

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: frontmatter.title,
    description: frontmatter.description ?? "",
    datePublished: frontmatter.date,
    author: { "@type": "Person", name: "mael", url: "https://mael.blog" },
    image: `https://mael.blog/images/article/${slug}.png`,
    url: `https://mael.blog/${slug}`,
  };

  return (
    <main className="w-full flex flex-col grow z-[2] min-h-screen">
      <Suspense>
        <Header />
      </Suspense>
      <ScrollArea className="h-screen w-full rounded-md">
        <article className="prose prose-zinc dark:prose-invert dark:bg-background w-full md:max-w-7xl mx-auto md:px-8 py-8">
          <Title title={frontmatter.title} />
          {content}
        </article>
      </ScrollArea>
    </main>
  );
}
