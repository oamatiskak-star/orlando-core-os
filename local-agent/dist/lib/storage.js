"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadVideoToStorage = uploadVideoToStorage;
exports.deleteFromStorage = deleteFromStorage;
const supabase_js_1 = require("@supabase/supabase-js");
const fs_1 = __importDefault(require("fs"));
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = 'yt-videos';
async function uploadVideoToStorage(localPath, storagePath) {
    const buffer = fs_1.default.readFileSync(localPath);
    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
        contentType: 'video/mp4',
        upsert: true,
        cacheControl: '3600',
    });
    if (error)
        throw new Error(`Storage upload mislukt: ${error.message}`);
    // Signed URL geldig 7 dagen (voor engine om te downloaden)
    const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 7 * 24 * 3600);
    if (!signed?.signedUrl)
        throw new Error('Kon geen signed URL aanmaken');
    return signed.signedUrl;
}
async function deleteFromStorage(storagePath) {
    const { error } = await supabase.storage
        .from(BUCKET)
        .remove([storagePath]);
    if (error)
        console.warn(`Storage delete mislukt (${storagePath}):`, error.message);
}
