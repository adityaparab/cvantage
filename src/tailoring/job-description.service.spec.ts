import {
  JobDescriptionService,
  JobPageNetwork,
  jobPageText,
  publicAddress,
  publicJobUrl,
} from './job-description.service';
import { ResumeRepository } from '../database/resume.repository';
import { analysisSchema } from './analysis';
describe('job page import boundaries', () => {
  const network = new JobPageNetwork();
  const resumes = {
    get: jest.fn().mockResolvedValue({}),
    getPii: jest.fn().mockResolvedValue({
      name: 'Sample Person',
      email: 'sample@example.test',
      contactNumber: '',
      location: '',
    }),
  };
  const service = new JobDescriptionService(
    resumes as unknown as ResumeRepository,
    network,
  );
  const resolve = jest.spyOn(network, 'resolve');
  const read = jest.spyOn(network, 'read');
  beforeEach(() => {
    jest.clearAllMocks();
    resolve.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('rejects nonpublic address %s', (address) =>
    expect(publicAddress(address)).toBe(false),
  );
  it.each([
    'http://example.com',
    'https://example.com:444',
    'https://user:password@example.com',
    'https://127.1',
    'https://[::1]',
    'https://machine.local',
  ])('rejects unsafe URL %s', (url) =>
    expect(() => publicJobUrl(url)).toThrow(),
  );
  it('pins a checked address and returns editable redacted plain text', async () => {
    read.mockResolvedValueOnce({
      status: 200,
      type: 'text/html',
      body: Buffer.from(
        '<script>secret()</script><nav>Menu</nav><main><h1>Engineer &amp; designer</h1><p>Build useful tools. Contact Sample Person at sample@example.test.</p></main>',
      ),
    });
    const result = await service.import('owner', 'resume', {
      url: 'https://jobs.example.com/role',
    });
    expect(result.text).toContain('Engineer & designer');
    expect(result.text).toContain('PII_NAME');
    expect(result.text).not.toMatch(/Menu|secret|Sample Person|sample@example/);
    expect(read.mock.calls[0][1]).toEqual({
      address: '93.184.216.34',
      family: 4,
    });
  });
  it('rejects mixed public/private DNS without making a request', async () => {
    resolve.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);
    await expect(
      service.import('owner', 'resume', { url: 'https://jobs.example.com' }),
    ).rejects.toThrow('Paste');
    expect(read).not.toHaveBeenCalled();
  });
  it('revalidates redirect destinations and limits redirect loops', async () => {
    read.mockResolvedValueOnce({
      status: 302,
      location: 'https://169.254.169.254/latest',
      type: '',
      body: Buffer.alloc(0),
    });
    await expect(
      service.import('owner', 'resume', { url: 'https://jobs.example.com' }),
    ).rejects.toThrow('Paste');
    expect(read).toHaveBeenCalledTimes(1);
    read.mockClear().mockResolvedValue({
      status: 302,
      location: '/again',
      type: '',
      body: Buffer.alloc(0),
    });
    await expect(
      service.import('owner', 'resume', { url: 'https://jobs.example.com' }),
    ).rejects.toThrow('Paste');
    expect(read).toHaveBeenCalledTimes(4);
  });
  it('rejects excessive/empty text and malformed analysis contracts', () => {
    expect(() =>
      jobPageText(Buffer.from('x'.repeat(30001)), 'text/plain'),
    ).toThrow();
    expect(() =>
      jobPageText(Buffer.from('<script>ignored</script>'), 'text/html'),
    ).toThrow();
    expect(
      analysisSchema.safeParse({ summary: '', findings: [] }).success,
    ).toBe(false);
    expect(
      analysisSchema.safeParse({
        summary: 'Relevant experience',
        findings: [],
        unexpected: true,
      }).success,
    ).toBe(false);
  });
});
