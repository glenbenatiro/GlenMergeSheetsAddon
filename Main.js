/**
 * KA Merge - Main
 * Louille Glen Benatiro
 * June 2024
 * glenbenatiro@gmail.com
 */

/* global GlenMerge */

const GMEA = {
  MERGE_CONFIG_USER_PROP_PARAMS_KEY_PREFIX: 'glenmerge-',
  MERGE_CONFIG_PARAMS_KEY: {
    TARGET_SHEET_ID: 'targetSheetID',
    ROW_FILTERS: 'rowFilters',
  },
  TARGET_SHEET_HEADER_ROW: 1,
  ERRORS: {
    TARGET_SHEET_NOT_FOUND: `Can't find the target sheet. Please open the target sheet and reopen the GlenMerge sidebar.`,
  },
  DROP_DOWN_SELECT_TEXT: 'Select',
  DROP_DOWN_SPECIFY_TEXT: '* SPECIFY *',
};

// -----------------------------------------------------------------------------

function getGoogleEntityIDFromURL(url) {
  let id = '';

  const parts = url.split(
    /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/,
  );

  if (url.indexOf('?id=') >= 0) {
    id = parts[6].split('=')[1].replace('&usp', '');
  } else {
    id = parts[5].split('/');

    const [sortArr] = id.sort((a, b) => b.length - a.length);

    id = sortArr;
  }

  return id;
}

// -----------------------------------------------------------------------------

function getPropertiesService() {
  return PropertiesService.getDocumentProperties();
}

function getProperty(key) {
  return JSON.parse(getPropertiesService().getProperty(key));
}

function setProperty(key, value) {
  getPropertiesService().setProperty(key, JSON.stringify(value));
}

// -----------------------------------------------------------------------------

function getRowFilterMergeConfigUserPropParamKey() {
  const prefix = GMEA.MERGE_CONFIG_USER_PROP_PARAMS_KEY_PREFIX;
  const keyword = GMEA.MERGE_CONFIG_PARAMS_KEY.ROW_FILTERS;
  const key = `${prefix}${keyword}`;

  return key;
}

function setRowFilters(rowFilters) {
  setProperty(getRowFilterMergeConfigUserPropParamKey(), rowFilters);
}

function getDefaultRowFilters() {
  return GlenMerge.createService().getRowFilters();
}

function getRowFilters() {
  let rowFilters = getProperty(getRowFilterMergeConfigUserPropParamKey());

  if (!rowFilters) {
    rowFilters = getDefaultRowFilters();

    setRowFilters(rowFilters);
  }

  return rowFilters;
}

function addRowFilters(filters) {
  const rowFilters = getRowFilters().concat(filters);

  setRowFilters(rowFilters);
}

function addRowFilter(filter) {
  addRowFilters([filter]);
}

function sheetColumnLettersToNumber(letters) {
  let n = 0;

  for (let p = 0; p < letters.length; p += 1) {
    n = letters[p].charCodeAt() - 64 + n * 26;
  }

  return n;
}

function getRowFiltersForFrontend() {
  const rowFilters = getRowFilters();
  const hdrRow = getDataSourceSheetHeaderNames();

  const colSecTypeInputToHeaderName = (input, columnSelectorType) => {
    switch (columnSelectorType) {
      case GlenMerge.ColumnSelectorType.SPECIFY:
        throw new Error(
          `Invalid ColumnSelectorType.SPECIFY value in this context.`,
        );

      case GlenMerge.ColumnSelectorType.SELECT_COL_HEADER:
        return input;

      case GlenMerge.ColumnSelectorType.SELECT_COL_LETTER:
        return hdrRow[sheetColumnLettersToNumber(input)];

      case GlenMerge.ColumnSelectorType.SELECT_COL_NUMBER:
        return hdrRow[input];

      default:
        throw new Error(`Invalid columnSelectorType: ${columnSelectorType}`);
    }
  };

  return rowFilters.reduce((accumulator, curr) => {
    const filter = {
      column: colSecTypeInputToHeaderName(curr.input, curr.type),
      operator: curr.operator,
      value: curr.rowContent,
    };

    accumulator.push(filter);

    return accumulator;
  }, []);
}

function setRowFiltersFromFrontend(filters) {
  const rowFilters = filters.reduce((accumulator, curr) => {
    const filter = {
      input: curr.column,
      type: GlenMerge.ColumnSelectorType.SELECT_COL_HEADER,
      operator: curr.operator,
      rowContent: curr.value,
    };

    accumulator.push(filter);

    return accumulator;
  }, []);

  setRowFilters(rowFilters);
}

function getMailMergeSenderEmailAddresses() {
  const arr = [Session.getActiveUser().getEmail(), ...GmailApp.getAliases()];
  return arr;
}

// -----------------------------------------------------------------------------

function getTargetSheetIDMergeConfigUserPropParamKey() {
  const prefix = GMEA.MERGE_CONFIG_USER_PROP_PARAMS_KEY_PREFIX;
  const keyword = GMEA.MERGE_CONFIG_PARAMS_KEY.TARGET_SHEET_ID;
  const key = `${prefix}${keyword}`;

  return key;
}

function getGlenMergeTargetSheet() {
  const sheetID = getProperty(getTargetSheetIDMergeConfigUserPropParamKey());

  if (sheetID) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheets()
      .find((currSheet) => String(currSheet.getSheetId()) === sheetID);

    if (sheet) {
      return sheet;
    }
  }

  throw new Error(
    `Can't find the active sheet. Please reopen the GlenMerge sidebar.`,
  );
}

function setGlenMergeTargetSheet() {
  // get id right away
  const sheet = SpreadsheetApp.getActiveSheet();
  const id = String(sheet.getSheetId());

  setProperty(getTargetSheetIDMergeConfigUserPropParamKey(), id);

  GlenMerge.addGlenMergeColsOnSheetIfNotPresent(sheet);
}

function uiShowSidebar() {
  setGlenMergeTargetSheet();
  getRowFilters(); // to add default row filters if not present

  const htmlOutput = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle(`KA Merge ${getLatestDeploymentVersion()}`)
    .setWidth(300);

  SpreadsheetApp.getUi().showSidebar(htmlOutput);
}

function uiReset() {
  getPropertiesService().deleteAllProperties();

  const text = `Previous merge configuration data have been deleted.`;

  SpreadsheetApp.getUi().alert(
    'Reset',
    text,
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}

function getLatestDeploymentVersion() {
  const url = `https://script.googleapis.com/v1/projects/${ScriptApp.getScriptId()}/deployments`;
  const options = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
    },
    muteHttpExceptions: true,
  };
  const response = UrlFetchApp.fetch(url, options);
  const { deployments } = JSON.parse(response.getContentText());
  const deployment = deployments.sort(
    (a, b) =>
      b.deploymentConfig.versionNumber - a.deploymentConfig.versionNumber,
  )[1];

  return deployment.deploymentConfig.description;
}

function uiAbout() {
  const text = `KA Merge\n\nVersion: ${getLatestDeploymentVersion()}\n\n(c) 2024 Louille Glen Benatiro, Kristal Kilat`;

  SpreadsheetApp.getUi().alert(
    'About',
    text,
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createAddonMenu()
    .addItem('Start', 'uiShowSidebar')
    .addItem('Reset', 'uiReset')
    .addItem('About', 'uiAbout')
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

// -----------------------------------------------------------------------------

function getPreviousMergeConfig(mergeConfig) {
  const userProps = getPropertiesService().getProperties();

  const prefix = GMEA.MERGE_CONFIG_USER_PROP_PARAMS_KEY_PREFIX;
  const prefixLength = prefix.length;

  const prevMergeConfig = Object.keys(userProps).reduce((accumulator, key) => {
    if (key.startsWith(prefix)) {
      accumulator[key.substring(prefixLength)] = getProperty(key);
    }

    return accumulator;
  }, {});

  return prevMergeConfig;
}

function saveMergeConfig(mergeConfig) {
  const prefix = GMEA.MERGE_CONFIG_USER_PROP_PARAMS_KEY_PREFIX;

  Object.entries(mergeConfig).forEach(([key, value]) => {
    const propKey = `${prefix}${key}`;

    setProperty(propKey, value);
  });
}

function runMerge(mergeConfig) {
  const conf = {
    ...mergeConfig,
    [GMEA.MERGE_CONFIG_PARAMS_KEY.ROW_FILTERS]: getRowFilters(),
  };
  
  const {
    // doc merge
    docMergeEnable,
    docMergeTemplateURL,
    docMergeOutputFolderURL,
    docMergeTitleDropdown,
    docMergeTitleInput,
    docMergeAsPDFCheckbox,

    // mail merge
    mailMergeEnable,
    mailMergeTemplateFolderURL,
    mailMergeTemplateURL,
    mailMergeSender,
    mailMergeSubjectDropdown,
    mailMergeSubjectInput,
    mailMergeRecipientDropdown,
    mailMergeRecipientInput,
    mailMergeCCCheckbox,
    mailMergeCCDropdown,
    mailMergeCCInput,
    mailMergeBCCCheckbox,
    mailMergeBCCDropdown,
    mailMergeBCCInput,
    mailMergeSendAsAttachmentCheckbox,

    //
    rowFilters,
  } = conf;

  const gm = GlenMerge.createService();
  const sheet = getGlenMergeTargetSheet();

  gm.loadDataSourceSheet(sheet);

  // doc merge
  if (docMergeEnable && docMergeEnable === true) {
    gm.enableDocMerge(docMergeEnable);
    gm.setDocMergeTemplateByURL(docMergeTemplateURL);
    gm.setDocMergeOutputFolderByURL(docMergeOutputFolderURL);

    if (docMergeTitleDropdown === GMEA.DROP_DOWN_SELECT_TEXT) {
      throw new Error(`docMergeTitleDropdown not set.`);
    } else if (docMergeTitleDropdown === GMEA.DROP_DOWN_SPECIFY_TEXT) {
      gm.setDocMergeTitle(
        docMergeTitleInput,
        GlenMerge.ColumnSelectorType.SPECIFY,
      );
    } else {
      gm.setDocMergeTitle(
        docMergeTitleDropdown,
        GlenMerge.ColumnSelectorType.SELECT_COL_HEADER,
      );
    }

    gm.setDocMergeSharedTo(null);
    gm.setDocMergeAsPDF(docMergeAsPDFCheckbox);
  }

  // mail merge
  if (mailMergeEnable && mailMergeEnable === true) {
    gm.enableMailMerge(mailMergeEnable);
    gm.setMailMergeTemplateByURL(mailMergeTemplateURL);

    if (mailMergeSender === GMEA.DROP_DOWN_SELECT_TEXT) {
      throw new Error(`mailMergeSender not set.`);
    } else {
      gm.setMailMergeSender(mailMergeSender);
    }

    if (mailMergeSubjectDropdown === GMEA.DROP_DOWN_SELECT_TEXT) {
      throw new Error(`mailMergeSubjectDropdown not set.`);
    } else if (mailMergeSubjectDropdown === GMEA.DROP_DOWN_SPECIFY_TEXT) {
      gm.setMailMergeSubject(
        mailMergeSubjectInput,
        GlenMerge.ColumnSelectorType.SPECIFY,
      );
    } else {
      gm.setMailMergeSubject(
        mailMergeSubjectDropdown,
        GlenMerge.ColumnSelectorType.SELECT_COL_HEADER,
      );
    }

    if (mailMergeRecipientDropdown === GMEA.DROP_DOWN_SELECT_TEXT) {
      throw new Error(`mailMergeRecipientDropdown not set.`);
    } else if (mailMergeRecipientDropdown === GMEA.DROP_DOWN_SPECIFY_TEXT) {
      gm.setMailMergeRecipient(
        mailMergeRecipientInput,
        GlenMerge.ColumnSelectorType.SPECIFY,
      );
    } else {
      gm.setMailMergeRecipient(
        mailMergeRecipientDropdown,
        GlenMerge.ColumnSelectorType.SELECT_COL_HEADER,
      );
    }

    if (!mailMergeCCCheckbox) {
      gm.setMailMergeCC(null);
    } else if (mailMergeCCDropdown === GMEA.DROP_DOWN_SELECT_TEXT) {
      throw new Error(`mailMergeCCDropdow not set.`);
    } else if (mailMergeCCDropdown === GMEA.DROP_DOWN_SPECIFY_TEXT) {
      gm.setMailMergeCC(mailMergeCCInput, GlenMerge.ColumnSelectorType.SPECIFY);
    } else {
      gm.setMailMergeCC(
        mailMergeCCDropdown,
        GlenMerge.ColumnSelectorType.SELECT_COL_HEADER,
      );
    }

    if (!mailMergeBCCCheckbox) {
      gm.setMailMergeBCC(null);
    } else if (mailMergeBCCDropdown === GMEA.DROP_DOWN_SELECT_TEXT) {
      throw new Error(`mailMergeBCCDropdown not set.`);
    } else if (mailMergeBCCDropdown === GMEA.DROP_DOWN_SPECIFY_TEXT) {
      gm.setMailMergeBCC(
        mailMergeBCCInput,
        GlenMerge.ColumnSelectorType.SPECIFY,
      );
    } else {
      gm.setMailMergeBCC(
        mailMergeBCCDropdown,
        GlenMerge.ColumnSelectorType.SELECT_COL_HEADER,
      );
    }
  }

  gm.setMailMergeSendAsAttachment(mailMergeSendAsAttachmentCheckbox);
  gm.addRowFilters(rowFilters);

  saveMergeConfig(mergeConfig);

  gm.run();

  return 'Finished executing.';
}

function getDocsName(docsURL) {
  return DocumentApp.openByUrl(docsURL).getName();
}

function getDataSourceSheetHeaderNames() {
  const gm = GlenMerge.createService();
  const sheet = getGlenMergeTargetSheet();

  gm.loadDataSourceSheet(sheet);

  return Object.keys(gm.getDataSourceSheetHeaderRowObject());
}

function loadSelectedTemplate() {
  const templateName = getProperty('templateName');
  const templateFolderUrl = getProperty('folder');
  const templateFolderId = templateFolderUrl
    .replaceAll('https://drive.google.com/drive/folders/', '')
    .trim();
  const templateFolder = DriveApp.getFolderById(templateFolderId);
  const templates = templateFolder.getFiles();

  while (templates.hasNext()) {
    const file = templates.next();

    if (file.getName() === templateName) {
      return {
        templateName,
        templateUrl: file.getUrl(),
      };
    }
  }

  return null;
}

function showMailMergeTemplateSelector(mailMergeTemplateFolderURL) {
  const folderID = getGoogleEntityIDFromURL(mailMergeTemplateFolderURL);
  const folder = DriveApp.getFolderById(folderID);
  const files = folder.getFiles();
  const templates = [];

  while (files.hasNext()) {
    const file = files.next();

    if (file.getMimeType() === 'application/vnd.google-apps.document') {
      templates.push({
        filename: file.getName(),
        url: file.getUrl(),
      });
    }
  }

  CacheService.getUserCache().put('mailMergeTemplatesObj', JSON.stringify(templates));

  const htmlOutput = HtmlService.createHtmlOutputFromFile('EmailTemplates.html');

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Select Mail Merge Template');
}

function getCachedMailMergeTemplatesObj() {
  return JSON.parse(CacheService.getUserCache().get('mailMergeTemplatesObj'));
}

function setMailMergeTemplateFromFrontend(mailMergeTemplateObj) {
  console.log(mailMergeTemplateObj);
}

function getTemplateTags(templateFolderUrl, fileName) {
  const templateFolderId = templateFolderUrl
    .replaceAll('https://drive.google.com/drive/folders/', '')
    .trim();
  const templateFolder = DriveApp.getFolderById(templateFolderId);
  const templates = templateFolder.getFiles();

  let docId = '';

  while (templates.hasNext()) {
    const file = templates.next();
    if (file.getName() === fileName) {
      docId = file.getId();
    }
  }
  const doc = DocumentApp.openById(docId);
  const text = doc.getBody().getText();
  const regex = /{{(.*?)}}/g;

  // Array to hold the matched words
  const matches = [];
  let match;

  // Use the exec method to find all matches in the string
  while ((match = regex.exec(text)) !== null) {
    // match[1] contains the word without the enclosing braces
    matches.push(match[1]);
  }

  return matches;
}

function getStyleString(attributes) {
  let styleString = '';
  if (attributes.BOLD) {
    styleString += 'font-weight: bold;';
  }
  if (attributes.ITALIC) {
    styleString += 'font-style: italic;';
  }
  if (attributes.UNDERLINE) {
    styleString += 'text-decoration: underline;';
  }

  return styleString;
}

function showTemplate(documentName) {
  const templateFolderUrl = getProperty('folder');
  const templateFolderId = templateFolderUrl
    .replaceAll('https://drive.google.com/drive/folders/', '')
    .trim();
  const templateFolder = DriveApp.getFolderById(templateFolderId);
  const templates = templateFolder.getFiles();

  let docId = '';

  while (templates.hasNext()) {
    const file = templates.next();
    if (file.getName() === documentName) {
      docId = file.getId();
    }
  }
  const doc = DocumentApp.openById(docId);
  const body = doc.getBody();

  const paragraphs = body.getParagraphs();

  let textWithFormat = '';

  for (let i = 0; i < paragraphs.length; i += 1) {
    const paragraph = paragraphs[i];
    const text = paragraph.getText();
    const attributes = paragraph.getAttributes();
    const attributesString = getStyleString(attributes);
    textWithFormat += `<p style="${attributesString}">${text}</p>`;
    const spacingAfter = paragraph.getSpacingAfter();
    textWithFormat += '<br>'.repeat(spacingAfter / 12);
  }

  const output = HtmlService.createTemplateFromFile('TemplatePreview.html');
  output.templateFormat = textWithFormat;
  const outputHtml = output.evaluate().setHeight(600).setWidth(600);

  SpreadsheetApp.getUi().showModalDialog(outputHtml, 'Template Preview');
}

function backToTemplates(driveUrl) {
  showEmailTemplateSelector(driveUrl);
}

function openSettings(columnNames) {
  const html = HtmlService.createTemplateFromFile('Settings.html');
  const htmlOutput = html.evaluate().setHeight(600).setWidth(600);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Row Filters');
}

function getRowFilterOperators() {
  return GlenMerge.RowFilterOperator;
}

// EOF
