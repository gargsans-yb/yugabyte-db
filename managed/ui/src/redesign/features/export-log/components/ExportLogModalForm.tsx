import { FC } from 'react';
import { toast } from 'react-toastify';
import { useMutation, useQuery } from 'react-query';
import { find } from 'lodash';
import { useTranslation, Trans } from 'react-i18next';
import { useForm, FormProvider } from 'react-hook-form';
import { Box, Typography, MenuItem, Divider } from '@material-ui/core';
import {
  YBSidePanel,
  YBLabel,
  YBInputField,
  YBRadioGroupField,
  RadioGroupOrientation,
  YBSelect,
  YBTooltip
} from '../../../components';

import { YBDropZoneField } from '../../../../components/configRedesign/providerRedesign/components/YBDropZone/YBDropZoneField';
import { YBFormSelect } from '../../../../components/common/forms/fields';
import { api } from '../../../utils/api';
import { api as universeApi } from '../../../../redesign/features/universe/universe-form/utils/api';
import { createErrorMessage } from '../../universe/universe-form/utils/helpers';
import { readFileAsText } from '../../../../components/configRedesign/providerRedesign/forms/utils';
import {
  ExportLogFormFields,
  TelemetryProviderType,
  ExportLogPayload,
  TPItem
} from '../utils/types';
import { TELEMETRY_PROVIDER_OPTIONS, DATADOG_SITES, LOKI_AUTH_TYPES } from '../utils/constants';
//RBAC
import { RuntimeConfigKey } from '../../../helpers/constants';
import { RunTimeConfig } from '../../../../redesign/features/universe/universe-form/utils/dto';
import { hasNecessaryPerm } from '../../rbac/common/RbacApiPermValidator';
import { ApiPermissionMap } from '../../rbac/ApiAndUserPermMapping';
import { RBAC_ERR_MSG_NO_PERM } from '../../rbac/common/validator/ValidatorUtils';

//styles
import { exportLogStyles } from '../utils/ExportLogStyles';
import InfoIcon from '../../../assets/info-message.svg';

interface ExportLogFormProps {
  open: boolean;
  onClose: () => void;
  formProps: TPItem | null;
}

export const ExportLogModalForm: FC<ExportLogFormProps> = ({ open, onClose, formProps }) => {
  const classes = exportLogStyles();
  const { t } = useTranslation();
  const isViewMode = formProps !== null;
  const formDefaultValues = isViewMode
    ? formProps
    : {
        config: {
          type: TelemetryProviderType.DATA_DOG,
          site: DATADOG_SITES[0].value
        }
      };

  const formMethods = useForm<ExportLogFormFields>({
    defaultValues: formDefaultValues,
    mode: 'onChange',
    reValidateMode: 'onChange'
  });

  const { control, handleSubmit, watch, setValue } = formMethods;

  const createTelemetryProvider = useMutation(
    (values: ExportLogPayload) => {
      return api.createTelemetryProvider(values);
    },
    {
      onSuccess: (data: any) => {
        toast.success('Create export configuration', data?.name);
        onClose();
      },
      onError: (error) => {
        toast.error(createErrorMessage(error));
      }
    }
  );

  const providerTypeValue = watch('config.type');
  const dataDogSiteValue = watch('config.site');
  const lokiAuthTypeValue = watch('config.authType');

  const isLokiTelemetryEnabled = (runtimeConfigs: RunTimeConfig) => {
    return find(runtimeConfigs?.configEntries, (config) => config.key === RuntimeConfigKey.LOKI_TELEMETRY_ALLOW)?.value === 'true';
  };

  const { data: runtimeConfigs, isLoading: runtimeConfigLoading, isError } = useQuery(RuntimeConfigKey.LOKI_TELEMETRY_ALLOW, () =>
    universeApi.fetchRunTimeConfigs(true)
  );

  const handleFormSubmit = handleSubmit(async (values) => {
    try {
      const payload: ExportLogPayload = {
        name: values.name,
        config: {
          type: values.config.type
        }
      };
      if (values.config.type === TelemetryProviderType.DATA_DOG) {
        payload.config.site = values.config?.site;
        payload.config.apiKey = values.config?.apiKey;
      }
      if (values.config.type === TelemetryProviderType.GCP_CLOUD_MONITORING) {
        payload.config.project = values.config?.project;
        if (values.config?.gcpCredentials) {
          const jsonVal = await readFileAsText(values.config.gcpCredentials);
          if (jsonVal) {
            try {
              payload.config.credentials = JSON.parse(jsonVal);
            } catch (error) {
              toast.error(`An error occured while parsing the service account JSON: ${error}`);
              return;
            }
          }
        }
      }
      if (values.config.type === TelemetryProviderType.SPLUNK) {
        payload.config.endpoint = values.config?.endpoint;
        payload.config.token = values.config?.token;
        payload.config.source = values.config?.source;
        payload.config.sourceType = values.config?.sourceType;
        payload.config.index = values.config?.index;
      }
      if (values.config.type === TelemetryProviderType.AWS_CLOUDWATCH) {
        payload.config.accessKey = values.config?.accessKey;
        payload.config.secretKey = values.config?.secretKey;
        payload.config.logGroup = values.config?.logGroup;
        payload.config.logStream = values.config?.logStream;
        payload.config.region = values.config?.region;
        payload.config.roleARN = values.config?.roleARN;
        payload.config.endpoint = values.config?.endpoint;
      }
      if (values.config.type == TelemetryProviderType.LOKI) {
        payload.config.endpoint = values.config?.endpoint;

        payload.config.organizationID = values.config?.organizationID;

        payload.config.authType = values.config?.authType;

        if (values.config.authType === 'BasicAuth') {
          payload.config.basicAuth = values.config?.basicAuth;
        }

      }
      await createTelemetryProvider.mutateAsync(payload);
    } catch (e) {
      toast.error(createErrorMessage(e));
    }
  });

  const renderDatadogForm = () => {
    const isSelfHosted = DATADOG_SITES.every((ds) => ds.value !== dataDogSiteValue);
    return (
      <>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.dataDogApiKey')}</YBLabel>
          <YBInputField
            control={control}
            name="config.apiKey"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'DatadogForm-APIKey'
            }}
          />
        </Box>
        <Box display={'flex'} flexDirection={'row'} mt={3}>
          <Box display={'flex'} flexShrink={1} width="200px" flexDirection={'column'}>
            <YBLabel>{t('exportAuditLog.dataDogSite')}</YBLabel>
            <YBSelect
              fullWidth
              value={dataDogSiteValue}
              onChange={(e) => setValue('config.site', e.target.value)}
              renderValue={() =>
                DATADOG_SITES.find((ds) => ds.value === dataDogSiteValue)?.name ?? ' Self-hosted'
              }
              disabled={isViewMode}
              inputProps={{
                'data-testid': 'DatadogForm-SiteSelect'
              }}
            >
              {DATADOG_SITES.map((item) => (
                <MenuItem
                  key={item.value}
                  value={item.value}
                  className={classes.dataDogmenuItem}
                  data-testid={`DatadogForm-${item.value}`}
                >
                  <Typography variant="body1">{item.name}</Typography>
                  <Typography variant="subtitle1" color="textSecondary">
                    {item.value}
                  </Typography>
                </MenuItem>
              ))}
              <Divider />
              <MenuItem
                key={'selfHosted'}
                value={''}
                className={classes.dataDogmenuItem}
                data-testid={`DatadogForm-SelfHosted`}
              >
                <Typography variant="body1">{'Self-hosted'}</Typography>
                <Typography variant="subtitle1" color="textSecondary">
                  {t('exportAuditLog.dataDogURLPlaceholder')}
                </Typography>
              </MenuItem>
            </YBSelect>
          </Box>
          <Box display={'flex'} ml={2} width="100%" flexDirection={'column'}>
            <YBLabel>{t('exportAuditLog.siteURL')}</YBLabel>
            <YBInputField
              control={control}
              name="config.site"
              disabled={!isSelfHosted || isViewMode}
              fullWidth
              inputProps={{
                'data-testid': 'DatadogForm-SiteInput'
              }}
            />
          </Box>
        </Box>
      </>
    );
  };

  const renderSplunkForm = () => {
    return (
      <>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.splunkToken')}</YBLabel>
          <YBInputField
            control={control}
            name="config.token"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'SplunkForm-Token'
            }}
          />
        </Box>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.endpointURL')}</YBLabel>
          <YBInputField
            control={control}
            name="config.endpoint"
            placeholder="https://"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'SplunkForm-EndPoint'
            }}
          />
        </Box>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.source')}</YBLabel>
          <YBInputField
            control={control}
            name="config.source"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'SplunkForm-Source'
            }}
          />
        </Box>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.sourceType')}</YBLabel>
          <YBInputField
            control={control}
            name="config.sourceType"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'SplunkForm-SourceType'
            }}
          />
        </Box>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.splunkIndex')}</YBLabel>
          <YBInputField
            control={control}
            name="config.index"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'SplunkForm-Index'
            }}
          />
        </Box>
      </>
    );
  };


  const renderLokiForm = () => {
    return (
      <>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
        <Box display={'flex'} flexDirection={'row'} alignItems={'center'} mt={4}>
          <YBLabel width="200px">{t('exportAuditLog.lokiEndpoint')} &nbsp;
            <YBTooltip title={t('exportAuditLog.lokiEndpointTooltip')}>
              <img src={InfoIcon} />
            </YBTooltip>
          </YBLabel>
        </Box>
          <YBInputField
            control={control}
            name="config.endpoint"
            placeholder= {t('exportAuditLog.lokiEndpointPlaceholder')}
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'LokiForm-EndPoint'
            }}
            required={true}
            rules={{ required: 'This field is required' }}
          />
        </Box>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <Box display={'flex'} flexDirection={'row'} alignItems={'center'} mt={3}>
            <Typography variant="body2">
              {t('exportAuditLog.lokiOrganizationID')} &nbsp;
            </Typography>
            <YBTooltip title={t('exportAuditLog.lokiOrganizationIDTooltip')}>
              <img src={InfoIcon} />
            </YBTooltip>
          </Box>
          <YBInputField
            control={control}
            name="config.organizationID"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'LokiForm-OrganizationID'
            }}
          />
        </Box>
        {/* Auth Type Selection */}
        <Box className={classes.mainFieldContainer}>
            <Typography className={classes.exportToTitle}>
              {t('exportAuditLog.authType')}
            </Typography>
            <YBRadioGroupField
              name="config.authType"
              control={control}
              options={LOKI_AUTH_TYPES}
              orientation={RadioGroupOrientation.VERTICAL}
              isDisabled={isViewMode}
            />
            {lokiAuthTypeValue === 'BasicAuth' && renderLokiBasicAuthForm()}
          </Box>
      </>
    );
  };

  const renderLokiBasicAuthForm = () => {
    {/* Username/Password Fields (Only when Basic Auth selected) */}
     return (
      <>
        <Box display="flex" flexDirection="column" width="100%" mt={3}>
          <YBLabel>{t('exportAuditLog.lokiUsername')}</YBLabel>
          <YBInputField
            control={control}
            name="config.basicAuth.username"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'LokiForm-Username'
            }}
            required={true}
            rules={{ required: 'This field is required' }}
          />
        </Box>
        <Box display="flex" flexDirection="column" width="100%" mt={3}>
          <YBLabel>{t('exportAuditLog.lokiPassword')}</YBLabel>
          <YBInputField
            control={control}
            name="config.basicAuth.password"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'LokiForm-Password'
            }}
            required={true}
            rules={{ required: 'This field is required' }}
          />
        </Box>
      </>
    )
  };

  const renderAWSWatchForm = () => {
    return (
      <>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.awsAccessKey')}</YBLabel>
          <YBInputField
            control={control}
            rules={{ required: 'This field is required' }}
            name="config.accessKey"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'AWSWatchForm-AccessKey'
            }}
          />
        </Box>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.awsSecretKey')}</YBLabel>
          <YBInputField
            control={control}
            rules={{ required: 'This field is required' }}
            name="config.secretKey"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'AWSWatchForm-SecretKey'
            }}
          />
        </Box>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.logGroup')}</YBLabel>
          <YBInputField
            control={control}
            rules={{ required: 'This field is required' }}
            name="config.logGroup"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'AWSWatchForm-LogGroup'
            }}
          />
        </Box>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.logStream')}</YBLabel>
          <YBInputField
            control={control}
            rules={{ required: 'This field is required' }}
            name="config.logStream"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'AWSWatchForm-LogStream'
            }}
          />
        </Box>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.awsRegion')}</YBLabel>
          <YBInputField
            control={control}
            rules={{ required: 'This field is required' }}
            name="config.region"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'AWSWatchForm-Region'
            }}
          />
        </Box>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.awsRoleARN')}</YBLabel>
          <YBInputField
            control={control}
            name="config.roleARN"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'AWSWatchForm-RoleARN'
            }}
          />
        </Box>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.awsEndpoint')}</YBLabel>
          <YBInputField
            control={control}
            name="config.endpoint"
            placeholder="https://"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'AWSWatchForm-EndPoint'
            }}
          />
        </Box>
      </>
    );
  };

  const renderGCPCloudForm = () => {
    return (
      <>
        <Box display={'flex'} flexDirection={'column'} width={'100%'} mt={3}>
          <YBLabel>{t('exportAuditLog.gcpProject')}</YBLabel>
          <YBInputField
            control={control}
            name="config.project"
            fullWidth
            disabled={isViewMode}
            inputProps={{
              'data-testid': 'GCPCloudForm-Project'
            }}
          />
        </Box>
        <Box display={'flex'} flexDirection={'column'} mt={3} width="100%">
          <YBDropZoneField
            name="config.gcpCredentials"
            control={control}
            actionButtonText={t('exportAuditLog.uploadGCPCredentails')}
            multipleFiles={false}
            showHelpText={true}
            className={classes.gcpJSONUploader}
            disabled={isViewMode}
            descriptionText={
              <span>
                <Trans i18nKey={'exportAuditLog.gcpDescription'} />
              </span>
            }
          />
        </Box>
      </>
    );
  };

  const canCreateTelemetryProvider = hasNecessaryPerm(ApiPermissionMap.CREATE_TELEMETRY_PROVIDER);

  return (
    <YBSidePanel
      open={open}
      title={isViewMode ? t('exportAuditLog.exportConfigForLogs') : t('exportAuditLog.modalTitle')}
      submitLabel={!isViewMode ? t('exportAuditLog.submitLabel') : undefined}
      onClose={onClose}
      cancelLabel={isViewMode ? t('common.close') : t('common.cancel')}
      overrideWidth={680}
      onSubmit={handleFormSubmit}
      submitTestId="ExportLogModalForm-Submit"
      cancelTestId="ExportLogModalForm-Cancel"
      buttonProps={{
        primary: {
          disabled: isViewMode || !canCreateTelemetryProvider
        }
      }}
      submitButtonTooltip={!canCreateTelemetryProvider ? RBAC_ERR_MSG_NO_PERM : ''}
    >
      <FormProvider {...formMethods}>
        <Box
          height="100%"
          width="100%"
          display="flex"
          flexDirection={'column'}
          pl={1}
          pt={1}
          pr={1}
          mb={3}
        >
          <YBLabel>{t('exportAuditLog.exportName')}</YBLabel>
          <Box display={'flex'} width={'384px'} mt={0.5}>
            <YBInputField
              control={control}
              rules={{ required: 'This field is required' }}
              name="name"
              placeholder="config_name_01"
              fullWidth
              disabled={isViewMode}
              inputProps={{
                'data-testid': 'ExportLogModalForm-ConfigName'
              }}
            />
          </Box>
          <Box className={classes.mainFieldContainer}>
            <Typography className={classes.exportToTitle}>
              {t('exportAuditLog.exportTo')}
            </Typography>
            <YBRadioGroupField
              name="config.type"
              control={control}
              options={TELEMETRY_PROVIDER_OPTIONS}
              orientation={RadioGroupOrientation.VERTICAL}
              isDisabled={isViewMode}
            />
            {providerTypeValue === TelemetryProviderType.DATA_DOG && renderDatadogForm()}
            {providerTypeValue === TelemetryProviderType.SPLUNK && renderSplunkForm()}
            {providerTypeValue === TelemetryProviderType.AWS_CLOUDWATCH && renderAWSWatchForm()}
            {providerTypeValue === TelemetryProviderType.GCP_CLOUD_MONITORING &&
              renderGCPCloudForm()}
            {(providerTypeValue === TelemetryProviderType.LOKI && (runtimeConfigs && isLokiTelemetryEnabled(runtimeConfigs) && !runtimeConfigLoading)) && renderLokiForm()}
          </Box>
        </Box>
      </FormProvider>
    </YBSidePanel>
  );
};
