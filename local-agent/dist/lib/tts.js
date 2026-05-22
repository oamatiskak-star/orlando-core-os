"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTTS = generateTTS;
exports.edgeTtsAvailable = edgeTtsAvailable;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
/**
 * Genereert TTS audio via edge-tts (Python package).
 * Installeer eenmalig: pip install edge-tts
 * Nederlandse stemmen: nl-NL-ColetteNeural, nl-NL-MaartjeNeural
 * Engelse stem: en-US-JennyNeural
 */
async function generateTTS(text, outputPath, voice = 'nl-NL-ColetteNeural') {
    // Schrijf script naar temp bestand (voorkomt shell-escape issues)
    const tmpScript = outputPath + '.script.txt';
    fs_1.default.writeFileSync(tmpScript, text, 'utf8');
    // Probeer edge-tts
    const edgeTts = (0, child_process_1.spawnSync)('edge-tts', [
        '--voice', voice,
        '--file', tmpScript,
        '--write-media', outputPath,
    ], { timeout: 60_000, encoding: 'utf8' });
    fs_1.default.unlinkSync(tmpScript);
    if (edgeTts.status === 0)
        return;
    // Fallback: espeak (op Linux, robotisch maar werkt altijd)
    console.warn('edge-tts niet gevonden, fallback naar espeak');
    const langCode = voice.startsWith('nl') ? 'nl' : 'en';
    const espeak = (0, child_process_1.spawnSync)('espeak', [
        '-v', langCode, '-f', '-', '-w', outputPath,
    ], {
        input: text,
        timeout: 60_000,
        encoding: 'utf8',
    });
    if (espeak.status !== 0) {
        throw new Error(`TTS mislukt: ${espeak.stderr}`);
    }
}
function edgeTtsAvailable() {
    try {
        (0, child_process_1.execSync)('edge-tts --version', { stdio: 'ignore', timeout: 5000 });
        return true;
    }
    catch {
        return false;
    }
}
