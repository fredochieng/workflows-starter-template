import { MyWorkflow } from "./workflow";

export { MyWorkflow };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && !url.searchParams.has("instanceId")) {
      return Response.json({
        service: "workflows-starter-template",
        status: "ok",
        usage: "POST / with a JSON payload to start a workflow, or POST /approve to resume it",
      });
    }

    const instanceId = url.searchParams.get("instanceId");
    if (request.method === "GET" && instanceId) {
      const instance = await env.MY_WORKFLOW.get(instanceId);
      return Response.json(await instance.status());
    }

    // Endpoint to send manager approval / rejection events to paused workflows
    if (request.method === "POST" && url.pathname === "/approve") {
      let body: any = {};
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }

      if (!body.instanceId) {
        return Response.json({ error: "Missing instanceId" }, { status: 400 });
      }

      const instance = await env.MY_WORKFLOW.get(body.instanceId);
      
      await instance.sendEvent({
        type: "manager-approval",
        payload: { approved: body.approved ?? true },
      });

      return Response.json({ 
        status: "approval event sent", 
        instanceId: body.instanceId,
        approved: body.approved ?? true 
      });
    }

    // Endpoint to create a new workflow instance
    if (request.method === "POST") {
      let payload: any = {};
      try {
        const text = await request.text();
        if (text) {
          payload = JSON.parse(text);
        }
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }

      const instance = await env.MY_WORKFLOW.create({ params: payload });

      return Response.json(
        {
          instanceId: instance.id,
          status: "started",
        },
        { status: 202 }
      );
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  },
};