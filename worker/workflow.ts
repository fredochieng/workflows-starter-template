import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

export type LeadPayload = {
  tenantId?: string;
  name?: string;
  email?: string;
  company?: string;
  budget?: number;
  interest?: "low" | "medium" | "high";
};

export class MyWorkflow extends WorkflowEntrypoint<Env, LeadPayload> {
  async run(event: WorkflowEvent<LeadPayload>, step: WorkflowStep) {
    const lead = event.payload || {};

    // Step 1: Start and parse lead
    await step.do("1. Start workflow", async () => ({
      tenantId: lead.tenantId ?? "default-tenant",
      startedAt: new Date().toISOString(),
    }));

    // Step 2: Calculate lead score with custom retry configuration
    const score = await step.do(
      "2. Calculate lead score",
      {
        retries: {
          limit: 3,
          delay: "5 seconds",
          backoff: "exponential",
        },
      },
      async () => {
        let points = 10;
        if (lead.company?.trim()) points += 20;
        if ((lead.budget ?? 0) >= 100_000) points += 40;
        if (lead.interest === "high") points += 40;
        return Math.min(points, 100);
      }
    );

    // Step 3: Conditional Branching & Dummy CRM Sync
    if (score >= 50) {
      await step.do("3a. Sync to Premium CRM (Mock)", async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return { tier: "Enterprise", synced: true };
      });

      // Step 4: Human-in-the-loop approval gate for high-value leads
      const approvalEvent = (await step.waitForEvent("3b. Wait for Manager Approval", {
        type: "manager-approval",
        timeout: "1 hour",
      })) as { payload?: { approved?: boolean }; approved?: boolean };

      // Safely extract approval status from either wrapper structure
      const isApproved = approvalEvent.payload?.approved ?? approvalEvent.approved;

      if (!isApproved) {
        return { status: "rejected", message: "Manager declined high-value lead" };
      }
    } else {
      await step.do("3c. Sync to Standard Pool (Mock)", async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return { tier: "Standard", synced: true };
      });
    }

    // Step 5: Finish workflow
    return await step.do("4. Finish workflow", async () => ({
      status: "completed",
      score,
      message: `Lead fully processed and qualified with score ${score}`,
    }));
  }
}