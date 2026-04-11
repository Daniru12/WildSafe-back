/**
 * Ranger — Groq client (integrations/ai/groq.js).
 * Uses jest.spyOn(axios, 'post') instead of jest.mock('axios') so ranger.integration / performance
 * still get a real axios when they load the app.
 */

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-dummy';
process.env.COHERE_API_KEY = process.env.COHERE_API_KEY || 'test-cohere-dummy';

const GROQ_PATH = '../../integrations/ai/groq';

describe('Ranger — groq.js', () => {
  const savedKey = process.env.GROQ_API_KEY;
  const savedModel = process.env.GROQ_MODEL;
  let postSpy;

  beforeEach(() => {
    const axios = require('axios');
    postSpy = jest.spyOn(axios, 'post');
  });

  afterEach(() => {
    postSpy.mockRestore();
    process.env.GROQ_API_KEY = savedKey;
    process.env.GROQ_MODEL = savedModel;
    jest.resetModules();
  });

  it('groqChat returns null and does not POST when API key is missing', async () => {
    process.env.GROQ_API_KEY = '';
    const { groqChat } = require(GROQ_PATH);
    await expect(groqChat([{ role: 'user', content: 'hello' }])).resolves.toBeNull();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('groqChat POSTs OpenAI-compatible payload and returns trimmed assistant text', async () => {
    process.env.GROQ_API_KEY = 'gsk-test-jest-key';
    process.env.GROQ_MODEL = 'test-model';
    postSpy.mockResolvedValueOnce({
      data: { choices: [{ message: { content: '  First action\nSecond action  ' } }] }
    });
    const { groqChat } = require(GROQ_PATH);
    const text = await groqChat(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'user prompt' }
      ],
      { max_tokens: 100, temperature: 0.5 }
    );
    expect(text).toBe('First action\nSecond action');
    expect(postSpy).toHaveBeenCalledTimes(1);
    const [url, body, opts] = postSpy.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(body.model).toBe('test-model');
    expect(body.messages).toHaveLength(2);
    expect(body.max_tokens).toBe(100);
    expect(body.temperature).toBe(0.5);
    expect(opts.headers.Authorization).toBe('Bearer gsk-test-jest-key');
    expect(opts.timeout).toBe(15000);
  });

  it('groqChat returns null on HTTP error', async () => {
    process.env.GROQ_API_KEY = 'gsk-test-jest-key';
    postSpy.mockRejectedValueOnce(new Error('network'));
    const { groqChat } = require(GROQ_PATH);
    await expect(groqChat([{ role: 'user', content: 'x' }])).resolves.toBeNull();
  });

  it('groqChat returns null when response has empty content', async () => {
    process.env.GROQ_API_KEY = 'gsk-test-jest-key';
    postSpy.mockResolvedValueOnce({ data: { choices: [{ message: { content: '' } }] } });
    const { groqChat } = require(GROQ_PATH);
    await expect(groqChat([{ role: 'user', content: 'x' }])).resolves.toBeNull();
  });
});
