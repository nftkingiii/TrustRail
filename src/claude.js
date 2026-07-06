export async function askClaudeForAuditNotes(input, checks) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      available: false,
      note: "Set ANTHROPIC_API_KEY to enable Claude-backed audit notes."
    };
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
      max_tokens: 1200,
      system:
        "You are TrustRail, a verification agent for agent commerce. Return only valid compact JSON with keys: reasoning, missingEvidence, deliveryAdvice. Do not use markdown fences.",
      messages: [
        {
          role: "user",
          content: JSON.stringify(
            {
              task: input.task,
              content: input.content,
              claims: input.claims,
              sources: input.sources,
              heuristicChecks: checks
            },
            null,
            2
          )
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API returned ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const body = await response.json();
  const text = body.content?.find((part) => part.type === "text")?.text || "";

  return {
    available: true,
    note: parseJsonOrText(text)
  };
}

function parseJsonOrText(text) {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
    : trimmed;

  try {
    return JSON.parse(jsonText);
  } catch {
    return text;
  }
}
