/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { HttpSetup } from 'kibana/public';
import { pipe } from 'fp-ts/lib/pipeable';
import { fold } from 'fp-ts/lib/Either';
import { Errors, identity } from 'io-ts';
import { RuleTaskState } from '../../../types';
import { INTERNAL_BASE_ALERTING_API_PATH } from '../../constants';
import { ruleStateSchema } from '../../../../../alerting/common';
import { AsApiContract, RewriteRequestCase } from '../../../../../actions/common';

const rewriteBodyRes: RewriteRequestCase<RuleTaskState> = ({
  rule_type_state: alertTypeState,
  alerts: alertInstances,
  previous_started_at: previousStartedAt,
  ...rest
}: any) => ({
  ...rest,
  alertTypeState,
  alertInstances,
  previousStartedAt,
});

type EmptyHttpResponse = '';
export async function loadAlertState({
  http,
  alertId,
}: {
  http: HttpSetup;
  alertId: string;
}): Promise<RuleTaskState> {
  return await http
    .get<AsApiContract<RuleTaskState> | EmptyHttpResponse>(
      `${INTERNAL_BASE_ALERTING_API_PATH}/rule/${alertId}/state`
    )
    .then((state) => (state ? rewriteBodyRes(state) : {}))
    .then((state: RuleTaskState) => {
      return pipe(
        ruleStateSchema.decode(state),
        fold((e: Errors) => {
          throw new Error(`Rule "${alertId}" has invalid state`);
        }, identity)
      );
    });
}
