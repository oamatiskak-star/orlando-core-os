"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPUS = exports.SONNET = exports.HAIKU = exports.anthropic = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey)
    throw new Error('ANTHROPIC_API_KEY is required');
exports.anthropic = new sdk_1.default({ apiKey });
exports.HAIKU = 'claude-haiku-4-5-20251001';
exports.SONNET = 'claude-sonnet-4-6';
exports.OPUS = 'claude-opus-4-7';
//# sourceMappingURL=anthropic.js.map