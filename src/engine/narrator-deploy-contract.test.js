import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflowUrl = new URL("../../.github/workflows/deploy.yml", import.meta.url);
const workflow = readFileSync(workflowUrl, "utf8");

describe("narrator release ordering", () => {
  it("deploys the matching Supabase narrate function before GitHub Pages", () => {
    expect(workflow).toContain("deploy-narrate:");
    expect(workflow).toContain("SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}");
    expect(workflow).toContain("SUPABASE_PROJECT_REF: ${{ vars.SUPABASE_PROJECT_REF }}");
    expect(workflow).toContain('supabase functions deploy narrate --project-ref "$SUPABASE_PROJECT_REF"');
    expect(workflow).toMatch(/deploy-narrate:\s+needs: build/);
    expect(workflow).toMatch(/\n  deploy:\s+needs: deploy-narrate/);

    const credentialCheck = workflow.indexOf("Check Supabase Edge deployment configuration");
    const edgeDeploy = workflow.indexOf("supabase functions deploy narrate");
    expect(credentialCheck).toBeGreaterThan(-1);
    expect(edgeDeploy).toBeGreaterThan(credentialCheck);
  });

  it("uses declared public repository variables for the browser contract", () => {
    expect(workflow).toContain("VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}");
    expect(workflow).toContain("VITE_SUPABASE_ANON_KEY: ${{ vars.VITE_SUPABASE_ANON_KEY }}");
    expect(workflow).not.toContain("vars.VITE_SUPABASE_URL || secrets.VITE_SUPABASE_URL");
    expect(workflow).not.toContain("vars.VITE_SUPABASE_ANON_KEY || secrets.VITE_SUPABASE_ANON_KEY");
  });
});
