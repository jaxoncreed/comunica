import { BindingsFactory } from '@comunica/bindings-factory';
import type { IActionRdfJoin } from '@comunica/bus-rdf-join';
import { ActorRdfJoin } from '@comunica/bus-rdf-join';
import type { IActionRdfJoinSelectivity, IActorRdfJoinSelectivityOutput } from '@comunica/bus-rdf-join-selectivity';
import type { Actor, IActorTest, Mediator } from '@comunica/core';
import { ActionContext, Bus } from '@comunica/core';
import type { IQueryableResultBindings, Bindings, IActionContext } from '@comunica/types';
import { ArrayIterator } from 'asynciterator';
import { DataFactory } from 'rdf-data-factory';
import { ActorRdfJoinHash } from '../lib/ActorRdfJoinHash';
const arrayifyStream = require('arrayify-stream');

const DF = new DataFactory();
const BF = new BindingsFactory();

function bindingsToString(b: Bindings): string {
  // eslint-disable-next-line @typescript-eslint/require-array-sort-compare
  const keys = b.keySeq().toArray().sort();
  return keys.map(k => `${k}:${b.get(k).value}`).toString();
}

describe('ActorRdfJoinHash', () => {
  let bus: any;
  let context: IActionContext;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
    context = new ActionContext();
  });

  describe('The ActorRdfJoinHash module', () => {
    it('should be a function', () => {
      expect(ActorRdfJoinHash).toBeInstanceOf(Function);
    });

    it('should be a ActorRdfJoinHash constructor', () => {
      expect(new (<any> ActorRdfJoinHash)({ name: 'actor', bus })).toBeInstanceOf(ActorRdfJoinHash);
      expect(new (<any> ActorRdfJoinHash)({ name: 'actor', bus })).toBeInstanceOf(ActorRdfJoin);
    });

    it('should not be able to create new ActorRdfJoinHash objects without \'new\'', () => {
      expect(() => { (<any> ActorRdfJoinHash)(); }).toThrow();
    });
  });

  describe('An ActorRdfJoinHash instance', () => {
    let mediatorJoinSelectivity: Mediator<
    Actor<IActionRdfJoinSelectivity, IActorTest, IActorRdfJoinSelectivityOutput>,
    IActionRdfJoinSelectivity, IActorTest, IActorRdfJoinSelectivityOutput>;
    let actor: ActorRdfJoinHash;
    let action: IActionRdfJoin;

    beforeEach(() => {
      mediatorJoinSelectivity = <any> {
        mediate: async() => ({ selectivity: 1 }),
      };
      actor = new ActorRdfJoinHash({ name: 'actor', bus, mediatorJoinSelectivity });
      action = {
        type: 'inner',
        entries: [
          {
            output: {
              bindingsStream: new ArrayIterator([], { autoStart: false }),
              metadata: () => Promise.resolve(
                { cardinality: 4, pageSize: 100, requestTime: 10, canContainUndefs: false },
              ),
              type: 'bindings',
              variables: [],
            },
            operation: <any>{},
          },
          {
            output: {
              bindingsStream: new ArrayIterator([], { autoStart: false }),
              metadata: () => Promise.resolve(
                { cardinality: 5, pageSize: 100, requestTime: 20, canContainUndefs: false },
              ),
              type: 'bindings',
              variables: [],
            },
            operation: <any>{},
          },
        ],
        context,
      };
    });

    it('should only handle 2 streams', () => {
      action.entries.push(<any> {});
      return expect(actor.test(action)).rejects.toBeTruthy();
    });

    it('should fail on undefs in left stream', () => {
      action = {
        type: 'inner',
        entries: [
          {
            output: {
              bindingsStream: new ArrayIterator([], { autoStart: false }),
              metadata: () => Promise.resolve(
                { cardinality: 4, pageSize: 100, requestTime: 10, canContainUndefs: true },
              ),
              type: 'bindings',
              variables: [],
            },
            operation: <any>{},
          },
          {
            output: {
              bindingsStream: new ArrayIterator([], { autoStart: false }),
              metadata: () => Promise.resolve(
                { cardinality: 5, pageSize: 100, requestTime: 20, canContainUndefs: false },
              ),
              type: 'bindings',
              variables: [],
            },
            operation: <any>{},
          },
        ],
        context,
      };
      return expect(actor.test(action)).rejects
        .toThrow(new Error('Actor actor can not join streams containing undefs'));
    });

    it('should fail on undefs in right stream', () => {
      action = {
        type: 'inner',
        entries: [
          {
            output: {
              bindingsStream: new ArrayIterator([], { autoStart: false }),
              metadata: () => Promise.resolve(
                { cardinality: 4, pageSize: 100, requestTime: 10, canContainUndefs: false },
              ),
              type: 'bindings',
              variables: [],
            },
            operation: <any>{},
          },
          {
            output: {
              bindingsStream: new ArrayIterator([], { autoStart: false }),
              metadata: () => Promise.resolve(
                { cardinality: 5, pageSize: 100, requestTime: 20, canContainUndefs: true },
              ),
              type: 'bindings',
              variables: [],
            },
            operation: <any>{},
          },
        ],
        context,
      };
      return expect(actor.test(action)).rejects
        .toThrow(new Error('Actor actor can not join streams containing undefs'));
    });

    it('should fail on undefs in left and right stream', () => {
      action = {
        type: 'inner',
        entries: [
          {
            output: {
              bindingsStream: new ArrayIterator([], { autoStart: false }),
              metadata: () => Promise.resolve(
                { cardinality: 4, pageSize: 100, requestTime: 10, canContainUndefs: true },
              ),
              type: 'bindings',
              variables: [],
            },
            operation: <any>{},
          },
          {
            output: {
              bindingsStream: new ArrayIterator([], { autoStart: false }),
              metadata: () => Promise.resolve(
                { cardinality: 5, pageSize: 100, requestTime: 20, canContainUndefs: true },
              ),
              type: 'bindings',
              variables: [],
            },
            operation: <any>{},
          },
        ],
        context,
      };
      return expect(actor.test(action)).rejects
        .toThrow(new Error('Actor actor can not join streams containing undefs'));
    });

    it('should generate correct test metadata', async() => {
      await expect(actor.test(action)).resolves
        .toEqual({
          iterations: 9,
          persistedItems: 4,
          blockingItems: 4,
          requestTime: 1.4,
        });
    });

    it('should generate correct metadata', async() => {
      await actor.run(action).then(async(result: IQueryableResultBindings) => {
        return expect((<any> result).metadata()).resolves.toHaveProperty('cardinality',
          (await (<any> action.entries[0].output).metadata()).cardinality *
          (await (<any> action.entries[1].output).metadata()).cardinality);
      });
    });

    it('should return an empty stream for empty input', () => {
      return actor.run(action).then(async(output: IQueryableResultBindings) => {
        expect(output.variables).toEqual([]);
        expect(await output.metadata()).toEqual({ cardinality: 20, canContainUndefs: false });
        expect(await arrayifyStream(output.bindingsStream)).toEqual([]);
      });
    });

    it('should join bindings with matching values', () => {
      action.entries[0].output.bindingsStream = new ArrayIterator([
        BF.bindings({ a: DF.literal('a'), b: DF.literal('b') }),
      ]);
      action.entries[0].output.variables = [ 'a', 'b' ];
      action.entries[1].output.bindingsStream = new ArrayIterator([
        BF.bindings({ a: DF.literal('a'), c: DF.literal('c') }),
      ]);
      action.entries[1].output.variables = [ 'a', 'c' ];
      return actor.run(action).then(async(output: IQueryableResultBindings) => {
        expect(output.variables).toEqual([ 'a', 'b', 'c' ]);
        expect(await output.metadata()).toEqual({ cardinality: 20, canContainUndefs: false });
        expect(await arrayifyStream(output.bindingsStream)).toEqual([
          BF.bindings({ a: DF.literal('a'), b: DF.literal('b'), c: DF.literal('c') }),
        ]);
      });
    });

    it('should not join bindings with incompatible values', () => {
      action.entries[0].output.bindingsStream = new ArrayIterator([
        BF.bindings({ a: DF.literal('a'), b: DF.literal('b') }),
      ]);
      action.entries[0].output.variables = [ 'a', 'b' ];
      action.entries[1].output.bindingsStream = new ArrayIterator([
        BF.bindings({ a: DF.literal('d'), c: DF.literal('c') }),
      ]);
      action.entries[1].output.variables = [ 'a', 'c' ];
      return actor.run(action).then(async(output: IQueryableResultBindings) => {
        expect(output.variables).toEqual([ 'a', 'b', 'c' ]);
        expect(await output.metadata()).toEqual({ cardinality: 20, canContainUndefs: false });
        expect(await arrayifyStream(output.bindingsStream)).toEqual([]);
      });
    });

    it('should join multiple bindings', () => {
      action.entries[0].output.bindingsStream = new ArrayIterator([
        BF.bindings({ a: DF.literal('1'), b: DF.literal('2') }),
        BF.bindings({ a: DF.literal('1'), b: DF.literal('3') }),
        BF.bindings({ a: DF.literal('2'), b: DF.literal('2') }),
        BF.bindings({ a: DF.literal('2'), b: DF.literal('3') }),
        BF.bindings({ a: DF.literal('3'), b: DF.literal('3') }),
        BF.bindings({ a: DF.literal('3'), b: DF.literal('4') }),
      ]);
      action.entries[0].output.variables = [ 'a', 'b' ];
      action.entries[1].output.bindingsStream = new ArrayIterator([
        BF.bindings({ a: DF.literal('1'), c: DF.literal('4') }),
        BF.bindings({ a: DF.literal('1'), c: DF.literal('5') }),
        BF.bindings({ a: DF.literal('2'), c: DF.literal('6') }),
        BF.bindings({ a: DF.literal('3'), c: DF.literal('7') }),
        BF.bindings({ a: DF.literal('0'), c: DF.literal('4') }),
        BF.bindings({ a: DF.literal('0'), c: DF.literal('4') }),
      ]);
      action.entries[1].output.variables = [ 'a', 'c' ];
      return actor.run(action).then(async(output: IQueryableResultBindings) => {
        const expected = [
          BF.bindings({ a: DF.literal('1'), b: DF.literal('2'), c: DF.literal('4') }),
          BF.bindings({ a: DF.literal('1'), b: DF.literal('2'), c: DF.literal('5') }),
          BF.bindings({ a: DF.literal('1'), b: DF.literal('3'), c: DF.literal('4') }),
          BF.bindings({ a: DF.literal('1'), b: DF.literal('3'), c: DF.literal('5') }),
          BF.bindings({ a: DF.literal('2'), b: DF.literal('2'), c: DF.literal('6') }),
          BF.bindings({ a: DF.literal('2'), b: DF.literal('3'), c: DF.literal('6') }),
          BF.bindings({ a: DF.literal('3'), b: DF.literal('3'), c: DF.literal('7') }),
          BF.bindings({ a: DF.literal('3'), b: DF.literal('4'), c: DF.literal('7') }),
        ];
        expect(output.variables).toEqual([ 'a', 'b', 'c' ]);
        // Mapping to string and sorting since we don't know order (well, we sort of know, but we might not!)
        expect((await arrayifyStream(output.bindingsStream)).map(bindingsToString).sort())
          // eslint-disable-next-line @typescript-eslint/require-array-sort-compare
          .toEqual(expected.map(bindingsToString).sort());
      });
    });
  });
});
