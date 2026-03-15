FROM oven/bun:latest

# Install system dependencies including Node.js (required by Claude Code CLI)
RUN apt-get update && apt-get install -y git curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Create a non-root user (Claude SDK refuses --dangerously-skip-permissions as root)
RUN useradd -m -s /bin/bash runaagent

# Pre-accept Claude Code terms for the non-root user
RUN mkdir -p /home/runaagent/.claude && \
    echo '{"ackTosVersion": "2025-02-24", "hasCompletedOnboarding": true}' > /home/runaagent/.claude/settings.json && \
    chown -R runaagent:runaagent /home/runaagent/.claude

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .
RUN bun run build

# Ensure the non-root user owns the workspace root for git clones
RUN mkdir -p /tmp/runa-workspaces && chown runaagent:runaagent /tmp/runa-workspaces

RUN chown -R runaagent:runaagent /app

USER runaagent

EXPOSE 3001
CMD ["bun", "run", "start:prod"]
