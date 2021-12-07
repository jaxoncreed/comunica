import { ActorAbstractPath } from '@comunica/actor-abstract-path';
import type { IActorQueryOperationTypedMediatedArgs } from '@comunica/bus-query-operation';
import {
  ActorQueryOperation,
} from '@comunica/bus-query-operation';
import type { IJoinEntry, MediatorRdfJoin } from '@comunica/bus-rdf-join';
import type { Bindings, IActionContext, IQueryableResult } from '@comunica/types';
import type * as RDF from '@rdfjs/types';
import { termToString } from 'rdf-string';
import { Algebra } from 'sparqlalgebrajs';

/**
 * A comunica Path Seq Query Operation Actor.
 */
export class ActorQueryOperationPathSeq extends ActorAbstractPath {
  public readonly mediatorJoin: MediatorRdfJoin;

  public constructor(args: IActorQueryOperationPathSeq) {
    super(args, Algebra.types.SEQ);
  }

  public async runOperation(
    operationOriginal: Algebra.Path,
    context: IActionContext,
  ): Promise<IQueryableResult> {
    const predicate = <Algebra.Seq> operationOriginal.predicate;

    let joiner: RDF.Term = operationOriginal.subject;
    const generatedVariableNames: string[] = [];
    const entries: IJoinEntry[] = await Promise.all(predicate.input
      .map((subPredicate, i) => {
        const nextJoiner = i === predicate.input.length - 1 ? operationOriginal.object : this.generateVariable(operationOriginal, `b${i}`);
        const operation = ActorAbstractPath.FACTORY
          .createPath(joiner, subPredicate, nextJoiner, operationOriginal.graph);
        const output = this.mediatorQueryOperation.mediate({
          context,
          operation,
        });

        joiner = nextJoiner;
        if (i < predicate.input.length - 1) {
          generatedVariableNames.push(termToString(nextJoiner));
        }

        return { output, operation };
      })
      .map(async({ output, operation }) => ({
        output: ActorQueryOperation.getSafeBindings(await output),
        operation,
      })));

    const join = ActorQueryOperation.getSafeBindings(await this.mediatorJoin
      .mediate({ type: 'inner', entries, context }));
    // Remove the generated variable from the bindings
    const bindingsStream = join.bindingsStream.transform<Bindings>({
      transform(item, next, push) {
        for (const generatedVariableName of generatedVariableNames) {
          item = item.delete(generatedVariableName);
        }
        push(item);
        next();
      },
    });

    // Remove the generated variable from the list of variables
    const variables = join.variables.filter(variable => !generatedVariableNames.includes(variable));
    return { type: 'bindings', bindingsStream, variables, metadata: join.metadata };
  }
}

export interface IActorQueryOperationPathSeq extends IActorQueryOperationTypedMediatedArgs {
  /**
   * A mediator for joining Bindings streams
   */
  mediatorJoin: MediatorRdfJoin;
}
