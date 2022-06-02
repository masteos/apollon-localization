const path = require("path");
const { useHelpers } = require('./helpers');

const flatten = (obj, roots=[], sep='.') => Object.keys(obj).reduce((memo, prop) => Object.assign({}, memo, Object.prototype.toString.call(obj[prop]) === '[object Object]' ? flatten(obj[prop], roots.concat([prop]), sep) : {[roots.concat([prop]).join(sep)]: obj[prop]}), {})
const markdownCollapsable = (title, content, isOpen = true) => `<details${isOpen ? ' open' : ''}><summary>\n\n${title}\n\n</summary>\n\n${content}\n\n</details>\n`;
const markdownKeyDiff = (key, addition, deletion) => `*${key}*\n\`\`\`diff\n${deletion ? `- ${deletion}\n`: ''}${addition ? `+ ${addition}\n`: ''}\`\`\``;
const markdownDiffs = (keys, headContent, baseContent) => keys.map(key => markdownKeyDiff(key, headContent[key], baseContent[key])).join('\n\n');
const markdownTextImage = (text, color, alt) => `![${alt}](https://dummyimage.com/20/${color}/000000.png&text=${text})`;

module.exports = async (githubContext) => {
  const { context, github } = githubContext;
  const { getPullRequestNumber, smartComment } = useHelpers(githubContext);

  const getFile = async (url) => {
    let file;
    try {
      file = (await github.request(url)).data;
    } catch (error) {
      return { file, content: {} };
    }
      
    if(file.encoding === 'base64') {
      file.content = Buffer.from(file.content, 'base64').toString()
    }
  
    const content = flatten(JSON.parse(file.content));
    return { file, content };
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

    const markdownTextImages = `${addedKeys.length ? markdownTextImage(addedKeys.length, 'dafbe1', 'Added') : ''}${modifiedKeys.length ? markdownTextImage(modifiedKeys.length, 'BF8800', 'Modified'):''}${modifiedKeys.length ? markdownTextImage(removedKeys.length, 'C6575E', 'Removed'):''}`;

    const markdownAdded = markdownCollapsable('#### Added', markdownDiffs(addedKeys, headContent, baseContent));
    const markdownModified = markdownCollapsable('#### Modified', markdownDiffs(modifiedKeys, headContent, baseContent));
    const markdownRemoved = markdownCollapsable('#### Removed', markdownDiffs(removedKeys, headContent, baseContent));
    const markdownFile = markdownCollapsable(`## 📑 ${path.basename(file.filename)} ${markdownTextImages}`, `${addedKeys.length ? '\n\n'+markdownAdded : ''}${modifiedKeys.length ? '\n\n'+markdownModified : ''}${removedKeys.length ? '\n\n'+markdownRemoved : ''}`, false);
    markdown += `\n${markdownFile}\n`;
  }

  await smartComment(markdown);
}
