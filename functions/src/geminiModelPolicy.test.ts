import { strict as assert } from 'assert';
import { test } from 'node:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { normalizeGeminiModelName, geminiTextGenerationOptions } from './geminiModelPolicy';
import { normalizeExcelModel } from './excelConversionModel';

test('browser and server model policies stay identical across separate builds', () => {
    const browser = readFileSync(resolve(__dirname, '../../src/services/geminiModelPolicy.ts'), 'utf8');
    const server = readFileSync(resolve(__dirname, '../src/geminiModelPolicy.ts'), 'utf8');
    assert.equal(browser.replace(/\r\n/g, '\n'), server.replace(/\r\n/g, '\n'));
});

test('legacy settings resolve directly to supported models without changing custom models', () => {
    for (const model of ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-pro-preview-06-05']) {
        assert.equal(normalizeGeminiModelName(` models/${model} `), 'gemini-3.8-flash');
        assert.equal(normalizeExcelModel(model), 'gemini-3.8-flash');
    }
    assert.equal(normalizeGeminiModelName('gemini-2.5-flash-lite'), 'gemini-3.5-flash-lite');
    for (const model of ['gemini-2.0-flash-preview-image-generation', 'gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview', 'gemini-3.1-flash-image-preview']) {
        assert.equal(normalizeGeminiModelName(model), 'gemini-3.1-flash-image');
    }
    assert.equal(normalizeGeminiModelName('models/gemini-custom'), 'gemini-custom');
    assert.equal(normalizeGeminiModelName(' '), 'gemini-3.8-flash');
});

test('Gemini 3 requests use supported reasoning settings without legacy sampling controls', () => {
    for (const model of ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'models/gemini-3.7-flash']) {
        assert.deepEqual(geminiTextGenerationOptions(model, 0.05), { thinkingConfig: { thinkingLevel: 'low' } });
    }
    assert.deepEqual(geminiTextGenerationOptions('gemini-custom', 0.05), { temperature: 0.05 });
});
