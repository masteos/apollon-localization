const Reactions = {
  Confused: 'confused',
  Eyes: 'eyes',
  Heart: 'heart',
  Hooray: 'hooray',
  Laugh: 'laugh',
  Rocket: 'rocket',
  '+1': '+1',
  '-1': '-1',
};

const commentSignature = '';
const commentHistory = [];

const useHelpers = ({ args: commandArgs, github, context, exec: githubExec }) => {
  const exec = async (command, args = [], opts = {}) => {
    const output = {
      err: '',
      out: '',
      full: '',
    };

    const concatStd = type => data => {
      const str = data.toString();
      output[type] += str;
      output.full += str;
    };

    const options = {
      listeners: {
        stdout: concatStd('out'),
        stderr: concatStd('err'),
      },
      silent: true,
      ignoreReturnCode: true,
      ...opts,
    };

    const code = await githubExec.exec(command, args, options);

    if (code != 0) {
      const error = new Error(`Shell process failed with exit code ${code}`);
      error.command = command;
      error.args = args;
      error.code = code;
      error.stdout = output.out;
      error.stderr = output.err;
      error.stdfull = output.full;
      throw error;
    }

    return {
      code,
      stderr: output.err,
      stdout: output.out,
      stdfull: output.full,
    };
  };

  const getPullRequestNumber = () => {
    const payload = context.payload;
    return (payload.issue || payload.pull_request || payload).number;
  };

  const getCurrentPullRequest = async () => {
    if (context.payload.pull_request) {
      return context.payload.pull_request;
    }

    const pullRequest = await github.rest.pulls.get({
      ...context.repo,
      pull_number: getPullRequestNumber(),
    });

    return pullRequest.data;
  };

  const addComment = body =>
    github.rest.issues
      .createComment({
        ...context.repo,
        issue_number: getPullRequestNumber(),
        body: `${body}${commentSignature}`,
      })
      .then(response => {
        commentHistory.push(response.data);
        return response;
      });

  const smartComment = body => {
    if (commentHistory.length === 0) {
      return addComment(body);
    }

    const comment_id = commentHistory[commentHistory.length - 1].id;

    return github.rest.issues.updateComment({
      ...context.repo,
      body: `${body}${commentSignature}`,
      comment_id,
    });
  };

  const addReaction = (content = Reactions.Eyes) =>
    context.payload.comment &&
    github.rest.reactions.createForIssueComment({
      ...context.repo,
      comment_id: context.payload.comment.id,
      content,
    });

  return {
    exec,
    parseCommand: text => text.match(/^\/([\S]+) *(.*)?$/m),
    addComment,
    smartComment,
    addReaction,
    getCurrentPullRequest,
    getPullRequestNumber,
    firstArgument: commandArgs?.trim().split(' ')[0],
  };
};

module.exports = {
  Reactions,
  useHelpers,
};
