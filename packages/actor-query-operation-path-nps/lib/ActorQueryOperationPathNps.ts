import { ActorAbstractPath } from '@comunica/actor-abstract-path';
import type { IActorQueryOperationTypedMediatedArgs } from '@comunica/bus-query-operation';
import {
  ActorQueryOperation,
} from '@comunica/bus-query-operation';
import type { Bindings, IActionContext, IQueryableResult } from '@comunica/types';
import { termToString } from 'rdf-string';
import { Algebra } from 'sparqlalgebrajs';

/**
 * A comunica Path Nps Query Operation Actor.
 */
export class ActorQueryOperationPathNps extends ActorAbstractPath {
  public constructor(args: IActorQueryOperationTypedMediatedArgs) {
    super(args, Algebra.types.NPS);
  }

  public async runOperation(operation: Algebra.Path, context: IActionContext): Promise<IQueryableResult> {
    const predicate = <Algebra.Nps> operation.predicate;
    const blank = this.generateVariable(operation);
    const blankName = termToString(blank);

    const pattern = ActorAbstractPath.FACTORY
      .createPattern(operation.subject, blank, operation.object, operation.graph);
    const output = ActorQueryOperation.getSafeBindings(
      await this.mediatorQueryOperation.mediate({ operation: pattern, context }),
    );

    // Remove the generated blank nodes from the bindings
    const bindingsStream = output.bindingsStream.transform<Bindings>({
      filter(bindings) {
        return !predicate.iris.some(iri => iri.equals(bindings.get(blankName)));
      },
      transform(item, next, push) {
        push(item.delete(blankName));
        next();
      },
    });

    return {
      type: 'bindings',
      bindingsStream,
      variables: output.variables,
      metadata: output.metadata,
    };
  }
}
