#!/usr/bin/env bun

import { readFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";

function ensureString(value) {
  return typeof value === "string" ? value : "";
}

function extractJsonPayload(raw) {
  const trimmed = ensureString(raw).trim();
  if (!trimmed) {
    throw new Error("Translator returned empty content");
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  throw new Error("Translator output does not contain JSON payload");
}

function normalizeTranslations(parsed, inputTexts) {
  const map = new Map();
  if (parsed && Array.isArray(parsed.translations)) {
    for (const item of parsed.translations) {
      const key = ensureString(item?.key).trim();
      const text = ensureString(item?.text).trim();
      if (!key || !text) continue;
      map.set(key, text);
    }
  }

  return inputTexts.map((entry) => ({
    key: entry.key,
    text: map.get(entry.key) ?? entry.text,
  }));
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Missing translation payload file path");
  }

  const payload = JSON.parse(await readFile(inputPath, "utf8"));
  const targetLanguage = ensureString(payload?.targetLanguage).trim();
  const texts = Array.isArray(payload?.texts)
    ? payload.texts
        .map((item) => ({
          key: ensureString(item?.key).trim(),
          text: ensureString(item?.text).trim(),
        }))
        .filter((item) => item.key && item.text)
    : [];

  if (!targetLanguage) {
    throw new Error("targetLanguage cannot be empty");
  }
  if (texts.length === 0) {
    console.log(JSON.stringify({ model: null, translations: [] }));
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN");
  }

  const model = process.env.CLAUDE_TRANSLATION_MODEL || "claude-3-5-haiku-latest";
  const baseURL = ensureString(process.env.ANTHROPIC_BASE_URL).trim();
  const client = new Anthropic({
    apiKey,
    baseURL: baseURL || undefined,
  });

  const systemPrompt = [
    "You are a translation engine for Claude Code plugin metadata.",
    "Translate text into the target language accurately and naturally.",
    "Do not translate code identifiers, plugin IDs, command names, file paths, URLs, or version strings.",
    "Preserve markdown formatting and inline code snippets.",
    "Return JSON only with this shape: {\"translations\":[{\"key\":\"...\",\"text\":\"...\"}]}",
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      task: "translate_plugin_metadata",
      targetLanguage,
      texts,
    },
    null,
    2
  );

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const rawText = response.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n")
    .trim();

  const parsedPayload = JSON.parse(extractJsonPayload(rawText));
  const translations = normalizeTranslations(parsedPayload, texts);

  console.log(
    JSON.stringify({
      model,
      translations,
    })
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Plugin translation failed: ${message}`);
  process.exit(1);
});
