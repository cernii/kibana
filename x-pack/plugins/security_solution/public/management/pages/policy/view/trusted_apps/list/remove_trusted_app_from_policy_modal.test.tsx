/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  AppContextTestRender,
  createAppRootMockRenderer,
} from '../../../../../../common/mock/endpoint';
import { getPolicyDetailsArtifactsListPath } from '../../../../../common/routing';
import { isFailedResourceState, isLoadedResourceState } from '../../../../../state';
import React from 'react';
import { fireEvent, act } from '@testing-library/react';
import { policyDetailsPageAllApiHttpMocks } from '../../../test_utils';
import {
  RemoveTrustedAppFromPolicyModal,
  RemoveTrustedAppFromPolicyModalProps,
} from './remove_trusted_app_from_policy_modal';
import {
  PolicyArtifactsUpdateTrustedApps,
  PolicyDetailsTrustedAppsRemoveListStateChanged,
} from '../../../store/policy_details/action/policy_trusted_apps_action';
import { Immutable } from '../../../../../../../common/endpoint/types';
import { HttpFetchOptionsWithPath } from 'kibana/public';

describe('When using the RemoveTrustedAppFromPolicyModal component', () => {
  let appTestContext: AppContextTestRender;
  let renderResult: ReturnType<AppContextTestRender['render']>;
  let render: (waitForLoadedState?: boolean) => Promise<ReturnType<AppContextTestRender['render']>>;
  let waitForAction: AppContextTestRender['middlewareSpy']['waitForAction'];
  let mockedApis: ReturnType<typeof policyDetailsPageAllApiHttpMocks>;
  let onCloseHandler: jest.MockedFunction<RemoveTrustedAppFromPolicyModalProps['onClose']>;
  let trustedApps: RemoveTrustedAppFromPolicyModalProps['trustedApps'];

  beforeEach(() => {
    appTestContext = createAppRootMockRenderer();
    waitForAction = appTestContext.middlewareSpy.waitForAction;
    onCloseHandler = jest.fn();
    mockedApis = policyDetailsPageAllApiHttpMocks(appTestContext.coreStart.http);
    trustedApps = [
      // The 3rd trusted app generated by the HTTP mock is a Policy Specific one
      mockedApis.responseProvider.trustedAppsList({ query: {} } as HttpFetchOptionsWithPath)
        .data[2],
    ];

    // Delay the Update Trusted App API response so that we can test UI states while the update is underway.
    mockedApis.responseProvider.trustedAppUpdate.mockDelay.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 100);
        })
    );

    render = async (waitForLoadedState: boolean = true) => {
      const pendingDataLoadState = waitForLoadedState
        ? Promise.all([
            waitForAction('serverReturnedPolicyDetailsData'),
            waitForAction('assignedTrustedAppsListStateChanged', {
              validate({ payload }) {
                return isLoadedResourceState(payload);
              },
            }),
          ])
        : Promise.resolve();

      appTestContext.history.push(
        getPolicyDetailsArtifactsListPath('ddf6570b-9175-4a6d-b288-61a09771c647')
      );
      renderResult = appTestContext.render(
        <RemoveTrustedAppFromPolicyModal trustedApps={trustedApps} onClose={onCloseHandler} />
      );

      await pendingDataLoadState;

      return renderResult;
    };
  });

  const getConfirmButton = (): HTMLButtonElement =>
    renderResult.getByTestId('confirmModalConfirmButton') as HTMLButtonElement;

  const clickConfirmButton = async (
    /* wait for the UI action to the store middleware to initialize the remove */
    waitForUpdateRequestActionDispatch: boolean = false,
    /* wait for the removal to succeed */
    waitForRemoveSuccessActionDispatch: boolean = false
  ): Promise<
    Immutable<
      Array<PolicyArtifactsUpdateTrustedApps | PolicyDetailsTrustedAppsRemoveListStateChanged>
    >
  > => {
    const pendingConfirmStoreAction = waitForAction('policyArtifactsUpdateTrustedApps');
    const pendingRemoveSuccessAction = waitForAction(
      'policyDetailsTrustedAppsRemoveListStateChanged',
      {
        validate({ payload }) {
          return isLoadedResourceState(payload);
        },
      }
    );

    act(() => {
      fireEvent.click(getConfirmButton());
    });

    let response: Array<
      PolicyArtifactsUpdateTrustedApps | PolicyDetailsTrustedAppsRemoveListStateChanged
    > = [];

    if (waitForUpdateRequestActionDispatch || waitForRemoveSuccessActionDispatch) {
      const pendingActions: Array<
        Promise<PolicyArtifactsUpdateTrustedApps | PolicyDetailsTrustedAppsRemoveListStateChanged>
      > = [];

      if (waitForUpdateRequestActionDispatch) {
        pendingActions.push(pendingConfirmStoreAction);
      }

      if (waitForRemoveSuccessActionDispatch) {
        pendingActions.push(pendingRemoveSuccessAction);
      }

      await act(async () => {
        response = await Promise.all(pendingActions);
      });
    }

    return response;
  };

  const clickCancelButton = () => {
    act(() => {
      fireEvent.click(renderResult.getByTestId('confirmModalCancelButton'));
    });
  };

  const clickCloseButton = () => {
    act(() => {
      fireEvent.click(renderResult.baseElement.querySelector('button.euiModal__closeIcon')!);
    });
  };

  it.each([
    ['cancel', clickCancelButton],
    ['close', clickCloseButton],
  ])('should call `onClose` callback when %s button is clicked', async (__, clickButton) => {
    await render();
    clickButton();

    expect(onCloseHandler).toHaveBeenCalled();
  });

  it('should dispatch action when confirmed', async () => {
    await render();
    const confirmedAction = (await clickConfirmButton(true))[0];

    expect(confirmedAction!.payload).toEqual({
      action: 'remove',
      artifacts: trustedApps,
    });
  });

  it('should disable and show loading state on confirm button while update is underway', async () => {
    await render();
    await clickConfirmButton(true);
    const confirmButton = getConfirmButton();

    expect(confirmButton.disabled).toBe(true);
    expect(confirmButton.querySelector('.euiLoadingSpinner')).not.toBeNull();
  });

  it.each([
    ['cancel', clickCancelButton],
    ['close', clickCloseButton],
  ])(
    'should prevent dialog dismissal if %s button is clicked while update is underway',
    async (__, clickButton) => {
      await render();
      await clickConfirmButton(true);
      clickButton();

      expect(onCloseHandler).not.toHaveBeenCalled();
    }
  );

  it('should show error toast if removal failed', async () => {
    const error = new Error('oh oh');
    mockedApis.responseProvider.trustedAppUpdate.mockImplementation(() => {
      throw error;
    });
    await render();
    await clickConfirmButton(true);
    await act(async () => {
      await waitForAction('policyDetailsTrustedAppsRemoveListStateChanged', {
        validate({ payload }) {
          return isFailedResourceState(payload);
        },
      });
    });

    expect(appTestContext.coreStart.notifications.toasts.addError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('oh oh') }),
      expect.objectContaining({ title: expect.any(String) })
    );
  });

  it('should show success toast and close modal when removed is successful', async () => {
    await render();
    await clickConfirmButton(true, true);

    expect(appTestContext.coreStart.notifications.toasts.addSuccess).toHaveBeenCalledWith({
      text: '"Avast Business Antivirus" has been removed from Endpoint Policy policy',
      title: 'Successfully removed',
    });
  });

  it('should show multiples removal success message', async () => {
    trustedApps = [
      ...trustedApps,
      {
        ...trustedApps[0],
        id: '123',
        name: 'trusted app 2',
      },
    ];

    await render();
    await clickConfirmButton(true, true);

    expect(appTestContext.coreStart.notifications.toasts.addSuccess).toHaveBeenCalledWith({
      text: '2 trusted applications have been removed from Endpoint Policy policy',
      title: 'Successfully removed',
    });
  });

  it('should trigger a refresh of trusted apps list data on successful removal', async () => {
    await render();
    const pendingActions = Promise.all([
      // request list refresh
      waitForAction('policyDetailsTrustedAppsForceListDataRefresh'),

      // list data refresh received
      waitForAction('assignedTrustedAppsListStateChanged', {
        validate({ payload }) {
          return isLoadedResourceState(payload);
        },
      }),
    ]);
    await clickConfirmButton(true, true);

    await expect(pendingActions).resolves.toHaveLength(2);
  });
});
