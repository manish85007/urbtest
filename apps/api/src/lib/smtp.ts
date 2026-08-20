import net from 'node:net';
import tls from 'node:tls';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export interface SmtpMessage {
  to: string[];
  subject: string;
  body: string;
}

function b64(s: string) {
  return Buffer.from(s, 'utf8').toString('base64');
}

function readReply(socket: net.Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    const onData = (chunk: Buffer) => {
      buf += chunk.toString('utf8');
      const lines = buf.split(/\r?\n/).filter((l) => l.length);
      const last = lines[lines.length - 1];
      if (last && /^\d{3} /.test(last)) {
        cleanup();
        resolve(buf);
      }
    };
    const onErr = (err: Error) => {
      cleanup();
      reject(err);
    };
    const onEnd = () => {
      cleanup();
      reject(new Error('SMTP connection closed unexpectedly.'));
    };
    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onErr);
      socket.off('end', onEnd);
    };
    socket.on('data', onData);
    socket.on('error', onErr);
    socket.on('end', onEnd);
  });
}

async function cmd(socket: net.Socket, expect: number, line?: string): Promise<string> {
  if (line !== undefined) socket.write(`${line}\r\n`);
  const reply = await readReply(socket);
  const code = Number(reply.slice(0, 3));
  if (code < expect || code >= expect + 100) {
    throw new Error(reply.trim() || `SMTP ${expect}x expected`);
  }
  return reply;
}

function connectRaw(host: string, port: number, secure: boolean): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host }, () => resolve(socket))
      : net.connect({ host, port }, () => resolve(socket));
    socket.setEncoding('utf8');
    socket.once('error', reject);
  });
}

function upgradeTls(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const tlsSock = tls.connect({ socket, host, servername: host }, () => resolve(tlsSock));
    tlsSock.setEncoding('utf8');
    tlsSock.once('error', reject);
  });
}

function encodeSubject(subject: string) {
  if (/^[\x20-\x7e]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${b64(subject)}?=`;
}

/** Port 587/25 use STARTTLS; port 465 uses implicit TLS. Mismatch causes OpenSSL "wrong version number". */
export function normalizeSmtpTls(config: SmtpConfig): SmtpConfig {
  const port = Number(config.port) || (config.secure ? 465 : 587);
  if (port === 465) {
    return { ...config, port: 465, secure: true };
  }
  if (port === 587 || port === 25) {
    return { ...config, port, secure: false };
  }
  return { ...config, port };
}

/** Minimal SMTP client (STARTTLS / implicit TLS + AUTH LOGIN). */
export async function sendSmtp(config: SmtpConfig, message: SmtpMessage): Promise<void> {
  const normalized = normalizeSmtpTls(config);
  const host = normalized.host.trim();
  const port = normalized.port;
  const secure = normalized.secure;
  if (!host) throw new Error('SMTP host is not set.');
  if (!message.to.length) throw new Error('No recipients.');

  let socket: net.Socket = await connectRaw(host, port, secure);
  try {
    await cmd(socket, 200);
    await cmd(socket, 200, `EHLO urb-tectrack`);

    if (!secure && port !== 465) {
      await cmd(socket, 200, 'STARTTLS');
      socket = await upgradeTls(socket, host);
      await cmd(socket, 200, `EHLO urb-tectrack`);
    }

    if (normalized.user) {
      await cmd(socket, 300, 'AUTH LOGIN');
      await cmd(socket, 300, b64(normalized.user));
      await cmd(socket, 200, b64(normalized.pass));
    }

    const from = normalized.fromEmail.trim();
    await cmd(socket, 200, `MAIL FROM:<${from}>`);
    for (const rcpt of message.to) {
      await cmd(socket, 200, `RCPT TO:<${rcpt}>`);
    }
    await cmd(socket, 300, 'DATA');

    const fromHeader = normalized.fromName ? `"${normalized.fromName.replace(/"/g, '')}" <${from}>` : from;
    const payload = [
      `From: ${fromHeader}`,
      `To: ${message.to.join(', ')}`,
      `Subject: ${encodeSubject(message.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      message.body.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..'),
      '.',
    ].join('\r\n');
    await cmd(socket, 200, payload);
    await cmd(socket, 200, 'QUIT').catch(() => undefined);
  } finally {
    socket.end();
    socket.destroy();
  }
}
