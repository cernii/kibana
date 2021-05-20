/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';

import type {
  UpdateExceptionListItemSchema,
  ExceptionListItemSchema,
} from '@kbn/securitysolution-io-ts-list-types';
import { getExceptionListItemResponseMockWithoutAutoGeneratedValues } from '../../../../plugins/lists/common/schemas/response/exception_list_item_schema.mock';
import { getCreateExceptionListItemMinimalSchemaMock } from '../../../../plugins/lists/common/schemas/request/create_exception_list_item_schema.mock';
import { getCreateExceptionListMinimalSchemaMock } from '../../../../plugins/lists/common/schemas/request/create_exception_list_schema.mock';
import { FtrProviderContext } from '../../common/ftr_provider_context';
import {
  EXCEPTION_LIST_URL,
  EXCEPTION_LIST_ITEM_URL,
} from '../../../../plugins/lists/common/constants';

import { deleteAllExceptions, removeExceptionListServerGeneratedProperties } from '../../utils';

import { getUpdateMinimalExceptionListItemSchemaMock } from '../../../../plugins/lists/common/schemas/request/update_exception_list_item_schema.mock';

// eslint-disable-next-line import/no-default-export
export default ({ getService }: FtrProviderContext) => {
  const supertest = getService('supertest');
  const es = getService('es');

  describe('update_exception_list_items', () => {
    describe('update exception list items', () => {
      afterEach(async () => {
        await deleteAllExceptions(es);
      });

      it('should update a single exception list item property of name using an id', async () => {
        // create a simple exception list
        await supertest
          .post(EXCEPTION_LIST_URL)
          .set('kbn-xsrf', 'true')
          .send(getCreateExceptionListMinimalSchemaMock())
          .expect(200);

        // create a simple exception list item
        await supertest
          .post(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(getCreateExceptionListItemMinimalSchemaMock())
          .expect(200);

        // update a exception list item's name
        const updatedList: UpdateExceptionListItemSchema = {
          ...getUpdateMinimalExceptionListItemSchemaMock(),
          name: 'some other name',
        };

        const { body } = await supertest
          .put(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(updatedList)
          .expect(200);

        const outputList: Partial<ExceptionListItemSchema> = {
          ...getExceptionListItemResponseMockWithoutAutoGeneratedValues(),
          name: 'some other name',
        };

        const bodyToCompare = removeExceptionListServerGeneratedProperties(body);
        expect(bodyToCompare).to.eql(outputList);
      });

      it('should update a single exception list item property of name using an auto-generated item_id', async () => {
        // create a simple exception list
        await supertest
          .post(EXCEPTION_LIST_URL)
          .set('kbn-xsrf', 'true')
          .send(getCreateExceptionListMinimalSchemaMock())
          .expect(200);

        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { item_id, ...itemNoId } = getCreateExceptionListItemMinimalSchemaMock();

        // create a simple exception list item
        const { body: createListBody } = await supertest
          .post(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(itemNoId)
          .expect(200);

        // update a exception list item's name
        const updatedList: UpdateExceptionListItemSchema = {
          ...getUpdateMinimalExceptionListItemSchemaMock(),
          item_id: createListBody.item_id,
          name: 'some other name',
        };

        const { body } = await supertest
          .put(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(updatedList)
          .expect(200);

        const outputList: Partial<ExceptionListItemSchema> = {
          ...getExceptionListItemResponseMockWithoutAutoGeneratedValues(),
          name: 'some other name',
          item_id: body.item_id,
        };
        const bodyToCompare = removeExceptionListServerGeneratedProperties(body);
        expect(bodyToCompare).to.eql(outputList);
      });

      it('should give a 404 if it is given a fake exception list item id', async () => {
        const updatedList: UpdateExceptionListItemSchema = {
          ...getUpdateMinimalExceptionListItemSchemaMock(),
          id: '5096dec6-b6b9-4d8d-8f93-6c2602079d9d',
        };
        delete updatedList.item_id;

        const { body } = await supertest
          .put(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(updatedList)
          .expect(404);

        expect(body).to.eql({
          status_code: 404,
          message: 'exception list item id: "5096dec6-b6b9-4d8d-8f93-6c2602079d9d" does not exist',
        });
      });

      it('should give a 404 if it is given a fake item_id', async () => {
        const updatedList: UpdateExceptionListItemSchema = {
          ...getUpdateMinimalExceptionListItemSchemaMock(),
          item_id: '5096dec6-b6b9-4d8d-8f93-6c2602079d9d',
        };

        const { body } = await supertest
          .put(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(updatedList)
          .expect(404);

        expect(body).to.eql({
          status_code: 404,
          message:
            'exception list item item_id: "5096dec6-b6b9-4d8d-8f93-6c2602079d9d" does not exist',
        });
      });

      it('should give a 404 if both id and list_id is null', async () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { item_id, ...listNoId } = getUpdateMinimalExceptionListItemSchemaMock();

        const { body } = await supertest
          .put(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(listNoId)
          .expect(404);

        expect(body).to.eql({
          status_code: 404,
          message: 'either id or item_id need to be defined',
        });
      });
    });
  });
};
