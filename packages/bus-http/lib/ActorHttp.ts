import type { IAction, IActorArgs, IActorOutput, IActorTest, Mediate } from '@comunica/core';
import { Actor } from '@comunica/core';
import type { Readable } from 'readable-stream';
import { ReadableWebToNodeStream } from 'readable-web-to-node-stream';

if (!global.ReadableStream) {
  global.ReadableStream = require('web-streams-ponyfill').ReadableStream;
}

const isStream = require('is-stream');
const toWebReadableStream = require('readable-stream-node-to-web');

/**
 * A base actor for listening to HTTP events.
 *
 * Actor types:
 * * Input:  IActionHttp:      The HTTP request.
 * * Test:   IActorHttpTest:   An estimate for the response time.
 * * Output: IActorHttpOutput: The HTTP response.
 *
 * @see IActionHttp
 * @see IActorHttpTest
 * @see IActorHttpOutput
 */
export abstract class ActorHttp extends Actor<IActionHttp, IActorTest, IActorHttpOutput> {
  /**
   * @param args - @defaultNested {<default_bus> a <cc:components/Bus.jsonld#Bus>} bus
   */
  public constructor(args: IActorHttpArgs) {
    super(args);
  }

  /**
   * Converts WhatWG streams to Node streams if required.
   * Returns the input in case the stream already is a Node stream.
   * @param {ReadableStream} body
   * @returns {NodeJS.ReadableStream}
   */
  public static toNodeReadable(body: ReadableStream | null): NodeJS.ReadableStream {
    return isStream(body) || body === null ?
      <NodeJS.ReadableStream> <any> body :
      <NodeJS.ReadableStream> <any> new ReadableWebToNodeStream(body);
  }

  /**
   * Converts Node streams to WhatWG streams.
   * @param {NodeJS.ReadableStream} body
   * @returns {ReadableStream}
   */
  public static toWebReadableStream(body: NodeJS.ReadableStream | null): ReadableStream {
    return toWebReadableStream(body);
  }

  /**
   * Convert the given headers object into a raw hash.
   * @param headers A headers object.
   */
  public static headersToHash(headers: Headers): Record<string, string> {
    const hash: Record<string, string> = {};
    headers.forEach((value, key) => {
      hash[key] = value;
    });
    return hash;
  }

  /**
   * Normalize the response body by adding methods to it if they are missing
   * @param body The response body
   * @param requestTimeout Optional timeout used for the cancel funtion
   */
  public static normalizeResponseBody(body?: Response['body'], requestTimeout?: NodeJS.Timeout): void {
    // Node-fetch does not support body.cancel, while it is mandatory according to the fetch and readablestream api.
    // If it doesn't exist, we monkey-patch it.
    if (body && !body.cancel) {
      body.cancel = async(error?: Error) => {
        (<Readable><any>body).destroy(error);
        if (requestTimeout !== undefined) {
          // We make sure to remove the timeout if it is still enabled
          clearTimeout(requestTimeout);
        }
      };
    }

    // Node-fetch does not support body.tee, while it is mandatory according to the fetch and readablestream api.
    // If it doesn't exist, we monkey-patch it.
    if (body && !body.tee) {
      body.tee = (): [ReadableStream, ReadableStream] => {
        // Why do we do an inline require here? Why do we use the base NodeJS `stream` library rather than the
        // `readable-stream` library from npm?
        //
        // Well, later down the road, we want to reconsutrct a `Response` using `new Response(teedStream)`. When calling
        // the constructor of Response in `node-fetch`, it checks to see what type of body was provided to it. If the
        // body is `instanceof Stream` it will leave the body alone
        // (https://github.com/node-fetch/node-fetch/blob/main/src/body.js#L53), if not it tried to convert it to a
        // buffer (https://github.com/node-fetch/node-fetch/blob/main/src/body.js#L62).
        //
        // So, when you pass in a `readable-stream` stream, `node-fetch` gets confused because a `readable-stream`
        // stream is not an instanceof the base NodeJS stream. So, it tries to convert it into a buffer which causes
        // the result of `await response.text()` to be `[object Object]` because, of course, `Buffer.from()` expects a
        // string, and `[object Object]` is the stratification of a stream object.
        //
        // This is an inline import because we don't want to require `stream` at the top for browser use cases as the
        // `stream` library won't be available in browser. Though the browser should never execute line 88 because its
        // response does have a `tee` method.
        //
        // eslint-disable-next-line import/no-nodejs-modules
        const stream = require('stream');
        const stream1 = (<Readable><any> body).pipe(new stream.PassThrough());
        const stream2 = (<Readable><any> body).pipe(new stream.PassThrough());
        return [ stream1, stream2 ];
      };
    }
  }
}

/**
 * The HTTP input, which contains the HTTP request.
 */
export interface IActionHttp extends IAction {
  input: RequestInfo;
  init?: RequestInit;
}

/**
 * The HTTP output, which contains the HTTP response.
 */
export interface IActorHttpOutput extends IActorOutput, Response {

}

export type IActorHttpArgs = IActorArgs<IActionHttp, IActorTest, IActorHttpOutput>;

export type MediatorHttp = Mediate<IActionHttp, IActorHttpOutput>;
