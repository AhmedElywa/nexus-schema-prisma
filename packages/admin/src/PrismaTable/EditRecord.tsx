import React, { useContext } from 'react';
import { Card } from '@paljs/ui/Card';
import { Tab, Tabs } from '@paljs/ui/Tabs';
import Row from '@paljs/ui/Row';
import Col from '@paljs/ui/Col';
import Spinner from '@paljs/ui/Spinner';
import Form from './Form';
import styled from 'styled-components';
import DynamicTable from './dynamicTable';
import { useLazyQuery } from '@apollo/client';
import { queryDocument } from './QueryDocument';
import { TableContext } from './Context';

interface EditRecordProps {
  model: string;
  update: any;
  view?: any;
  onSave: () => void;
}

const StyledTabs = styled(Tabs)<{ children: any }>`
  .tab-content {
    padding: 0;
  }
`;

const EditRecord: React.FC<EditRecordProps> = ({
  model,
  update,
  onSave,
  view,
}) => {
  const {
    schema: { models },
    push,
    pagesPath,
    onCancelUpdate,
  } = useContext(TableContext);
  const modelObject = models.find((item) => item.id === model);
  const [getRecord, { data, loading, error }] = useLazyQuery(
    queryDocument(models, model, true, true),
  );

  if (modelObject && !data && !loading && !error) {
    getRecord({
      variables: {
        where: { [modelObject.idField]: parseInt(update || view) },
      },
    });
  }

  const record = data ? data[`findOne${model}`] : {};
  const tabs = modelObject?.fields.filter(
    (field) => field.kind === 'object' && field.list && field.update,
  );

  if (!loading && data && !data[`findOne${model}`] && modelObject)
    push(pagesPath + model);

  const onUpdateCancel =
    onCancelUpdate ||
    function () {
      push(pagesPath + model);
    };

  return loading || !modelObject ? (
    <Spinner size="Giant" />
  ) : (
    <Row>
      <Col breakPoint={{ xs: 12 }}>
        <Form
          model={model}
          action={view ? 'view' : 'update'}
          data={record}
          onCancel={() => onUpdateCancel({ model })}
          onSave={onSave}
        />
      </Col>
      {!!tabs?.length && !!Object.keys(record).length && (
        <Col breakPoint={{ xs: 12 }}>
          <Card>
            <StyledTabs>
              {tabs.map((field) => {
                return (
                  <Tab title={field.title} key={field.id}>
                    <DynamicTable
                      model={field.type}
                      inEdit
                      filter={{ [model]: record[modelObject.idField] }}
                      parent={{ name: model, value: record }}
                    />
                  </Tab>
                );
              })}
            </StyledTabs>
          </Card>
        </Col>
      )}
    </Row>
  );
};

export default EditRecord;
