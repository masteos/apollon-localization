const path = require("path");
const { useHelpers } = require('./helpers');

const flatten = (obj, roots=[], sep='.') => Object.keys(obj).reduce((memo, prop) => Object.assign({}, memo, Object.prototype.toString.call(obj[prop]) === '[object Object]' ? flatten(obj[prop], roots.concat([prop]), sep) : {[roots.concat([prop]).join(sep)]: obj[prop]}), {})

const diffStartTag = '\n<!-- diff_start -->';
const diffEndTag = '\n<!-- diff_end -->';
// const diffTagRegex = new RegExp(`${diffStartTag}(.|\n)*${diffEndTag}`, 'gim');

module.exports = async (githubContext) => {
  const { context, github } = githubContext;
  const { getCurrentPullRequest, getPullRequestNumber } = useHelpers(githubContext);

  const getFile = async (url) => {
    const file = (await github.request(url)).data;
      
    if(file.encoding === 'base64') {
      file.content = Buffer.from(file.content, 'base64').toString()
    }
  
    const content = flatten(JSON.parse(file.content));
    return { file, content };
  }

  const updatePr = (options) => {
    return github.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
      ...context.repo,
      pull_number: getPullRequestNumber(),
      ...options
    })
  }


  const headSha = context.payload.pull_request.head.sha;
  const baseSha = context.payload.pull_request.base.sha;
  const files = (await github.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
    ...context.repo,
    pull_number: getPullRequestNumber(),
  })).data;

  let markdown = "";

  for (const file of files) {
    console.log('===========================');
    console.log(file.filename, file.status);

    
    const {content: headContent} = await getFile(file.contents_url);
    const {content: baseContent} = await getFile(file.contents_url.replace(headSha, baseSha));

    const baseKeys = Object.keys(baseContent);
    const headKeys = Object.keys(headContent);

    const removedKeys = baseKeys.filter((key) => !headKeys.includes(key)); 
    const addedKeys = headKeys.filter((key) => !baseKeys.includes(key));
    const modifiedKeys = headKeys.filter((key) => baseKeys.includes(key) && headContent[key] !== baseContent[key]);
    
    console.log({
      removedKeys,
      addedKeys,
      modifiedKeys
    });

    const templates = {
      added: `#### *{{key}}*\n\`\`\`diff\n+ {{head}}\n\`\`\``,
      modified: `#### *{{key}}*\n\`\`\`diff\n- {{base}}\n+ {{head}}\n\`\`\``,
      removed: `#### *{{key}}*\n\`\`\`diff\n- {{base}}\n\`\`\``,
    }

    const formatTemplate = (template, {key, base, head}) => templates[template].replace('{{key}}', key).replace('{{base}}', base).replace('{{head}}', head)

    const markdownAdded = `### Added\n${addedKeys.map(key => formatTemplate('added', {key, head: headContent[key]})).join('\n')}`;
    const markdownModified = `### Modified\n${modifiedKeys.map(key => formatTemplate('modified', {key, base: baseContent[key], head: headContent[key]})).join('\n')}`;
    const markdownRemoved = `### Removed\n${removedKeys.map(key => formatTemplate('removed', {key, base: baseContent[key]})).join('\n')}`;
    const markdownGif = Math.random() <= 0.25 ? '\n![the secret gif](https://media.giphy.com/media/FVZoYkTx3cuVCkEavD/giphy.gif)' : '';
    markdown += `\n## ${path.basename(file.filename)}${addedKeys.length ? '\n\n'+markdownAdded : ''}${modifiedKeys.length ? '\n\n'+markdownModified : ''}${removedKeys.length ? '\n\n'+markdownRemoved : ''}${markdownGif}`;
  }


  markdown = `${diffStartTag}${markdown}${diffEndTag}`

  // const body = (await getCurrentPullRequest()).body;

  await updatePr({
    body: /*(body || '').replace(diffTagRegex, '') + */markdown
  });
}
