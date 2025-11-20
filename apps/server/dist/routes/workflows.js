"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkflowRouter = createWorkflowRouter;
const express_1 = require("express");
const workflow_engine_1 = __importDefault(require("@agentic/workflow-engine"));
const active_workflows_1 = require("../store/active-workflows");
const persistence_1 = require("../services/persistence");
const config_1 = require("../config");
const logger_1 = require("../logger");
function validateGraph(graph) {
    return Boolean(graph && Array.isArray(graph.nodes) && Array.isArray(graph.connections));
}
async function persistResult(engine, result) {
    try {
        // Backward compatibility: fall back to reading the private graph field if the engine
        // instance doesn't yet expose getGraph (e.g., cached build).
        const engineAny = engine;
        const workflow = typeof engineAny.getGraph === 'function'
            ? engineAny.getGraph()
            : Reflect.get(engine, 'graph');
        if (!workflow) {
            throw new Error('Workflow graph not available on engine instance');
        }
        const record = {
            runId: result.runId,
            workflow,
            logs: result.logs,
            status: result.status
        };
        await (0, persistence_1.saveRunRecord)(config_1.config.runsDir, record);
    }
    catch (error) {
        logger_1.logger.error('Failed to persist run result', error);
    }
}
function createWorkflowRouter(llm) {
    const router = (0, express_1.Router)();
    router.post('/run', async (req, res) => {
        const { graph } = req.body;
        if (!validateGraph(graph)) {
            res.status(400).json({ error: 'Invalid workflow graph payload' });
            return;
        }
        try {
            const runId = Date.now().toString();
            const engine = new workflow_engine_1.default(graph, { runId, llm });
            (0, active_workflows_1.addWorkflow)(engine);
            const result = await engine.run();
            await persistResult(engine, result);
            res.json(result);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.logger.error('Failed to execute workflow', message);
            res.status(500).json({ error: 'Failed to execute workflow', details: message });
        }
    });
    router.post('/resume', async (req, res) => {
        const { runId, input } = req.body;
        if (!runId) {
            res.status(400).json({ error: 'runId is required' });
            return;
        }
        const engine = (0, active_workflows_1.getWorkflow)(runId);
        if (!engine) {
            res.status(404).json({ error: 'Run ID not found' });
            return;
        }
        try {
            const result = await engine.resume(input);
            await persistResult(engine, result);
            if (result.status !== 'paused') {
                (0, active_workflows_1.removeWorkflow)(runId);
            }
            res.json(result);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.logger.error('Failed to resume workflow', message);
            res.status(500).json({ error: 'Failed to resume workflow', details: message });
        }
    });
    return router;
}
