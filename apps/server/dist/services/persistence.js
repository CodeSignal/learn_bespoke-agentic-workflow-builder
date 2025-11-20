"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveRunRecord = saveRunRecord;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
async function saveRunRecord(runsDir, record) {
    const filePath = node_path_1.default.join(runsDir, `run_${record.runId}.json`);
    await promises_1.default.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');
}
