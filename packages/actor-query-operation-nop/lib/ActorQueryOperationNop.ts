import { BindingsFactory } from '@comunica/bindings-factory';
import type { IActorQueryOperationTypedMediatedArgs } from '@comunica/bus-query-operation';
import { ActorQueryOperationTypedMediated } from '@comunica/bus-query-operation';
import type { IActorTest } from '@comunica/core';
import type { IActionContext, IQueryableResult } from '@comunica/types';
import { SingletonIterator } from 'asynciterator';
import type { Algebra } from 'sparqlalgebrajs';

const BF = new BindingsFactory();
/**
 * A [Query Operation](https://github.com/comunica/comunica/tree/master/packages/bus-query-operation)
 * actor that handles SPARQL nop operations.
 */
export class ActorQueryOperationNop extends ActorQueryOperationTypedMediated<Algebra.Nop> {
  public constructor(args: IActorQueryOperationTypedMediatedArgs) {
    super(args, 'nop');
  }

  public async testOperation(operation: Algebra.Nop, context: IActionContext): Promise<IActorTest> {
    return true;
  }

  public async runOperation(operation: Algebra.Nop, context: IActionContext): Promise<IQueryableResult> {
    return {
      bindingsStream: new SingletonIterator(BF.bindings({})),
      metadata: () => Promise.resolve({ cardinality: 1, canContainUndefs: false }),
      type: 'bindings',
      variables: [],
    };
  }
}
