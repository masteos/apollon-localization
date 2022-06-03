const packageJson = require('../../package.json');

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

const Gifs = {
  NotFound: '![Not found](https://media.giphy.com/media/14uQ3cOFteDaU/giphy-downsized.gif)',
  Deploying: '![Deploying](https://media.giphy.com/media/dVnzGW7UehcEpwLxBm/giphy.gif)',
  Deployed: '![Deployed](https://media.giphy.com/media/tOxRB2tvzTscQPwXHv/giphy.gif)',
};

const commentSignature = '\n\n> **Masteos Deploy Bot** - Type ``/help`` to see available commands';
const codepushApp = {
  ios: 'masteos-tech/masteos',
  android: 'masteos-tech/masteos-android',
};

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

  const findApiPullRequests = async () => {
    const pullRequests = await github.rest.pulls.list({
      ...context.repo,
      repo: 'masteos',
      per_page: 100,
    });

    return pullRequests.data;
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

  const getPermissionLevel = async () => {
    const actorAccess = await github.rest.repos.getCollaboratorPermissionLevel({
      ...context.repo,
      username: context.actor,
    });

    return actorAccess.data.permission;
  };

  const getRelatedApiPullRequest = async apiBranchName => {
    const apiPullRequests = await findApiPullRequests();
    let targetName = apiBranchName ?? (await getCurrentPullRequest()).head.ref;
    return { targetName, targetPr: apiPullRequests.find(pr => pr.head.ref === targetName) };
  };

  const getLatestNativeBuildVersion = () => packageJson.version;
  const getPreviousNativeBuildVersion = async () => {
    const lastRelease = await github.rest.repos.getLatestRelease({
      owner,
      repo,
    });
    return lastRelease.tag_name;
  };

  return {
    exec,
    parseCommand: text => text.match(/^\/([\S]+) *(.*)?$/m),
    addComment,
    smartComment,
    addReaction,
    getPermissionLevel,
    getCurrentPullRequest,
    getPullRequestNumber,
    getRelatedApiPullRequest,
    findApiPullRequests,
    firstArgument: commandArgs?.trim().split(' ')[0],
    heroku: {
      getAppInfo: app => exec('heroku', ['apps:info', app, '--json']),
      setAppApiUrl: (app, apiUrl) => exec('heroku', ['config:set', `API_URL=${apiUrl}`, '-a', app]),
    },
    git: {
      getLatestNativeBuildVersion,
      getPreviousNativeBuildVersion,
    },
    appcenter: {
      listCodepushDeployments: () =>
        exec('yarn', [
          'appcenter',
          'codepush',
          'deployment',
          'list',
          '-ka',
          'masteos-tech/masteos-android',
        ]),
      createDeployment: (name, opts = { android: true, ios: true }) => {
        const commands = [];

        const computeBaseArguments = target => [
          'appcenter',
          'codepush',
          'deployment',
          'add',
          '-a',
          codepushApp[target],
          name,
        ];

        if (opts.ios) {
          commands.push(exec('yarn', computeBaseArguments('ios')));
        }

        if (opts.android) {
          commands.push(exec('yarn', computeBaseArguments('android')));
        }

        return Promise.all(commands);
      },
      releaseDeployment: async (name, opts = { android: true, ios: true }) => {
        const commands = [];

        const latestBinaryRelease = getLatestNativeBuildVersion();

        const computeBaseArguments = target => [
          'appcenter',
          'codepush',
          'release-react',
          '--extra-bundler-option=--reset-cache',
          '--mandatory',
          '--disable-duplicate-release-error',
          '--app',
          codepushApp[target],
          '-d',
          name,
          '-t',
          latestBinaryRelease,
          '--token',
          process.env.APPCENTER_ACCESS_TOKEN,
        ];

        const env = {
          NPM_TOKEN: process.env.NPM_TOKEN,
        };

        switch (name.toLowerCase()) {
          case 'production':
            env.ENVIRONMENT = 'production';
            env.API_URL = 'https://masteosv2.herokuapp.com';
            break;
          case 'staging':
            env.ENVIRONMENT = 'staging';
            env.API_URL = 'https://masteos-api-staging.herokuapp.com';
            break;
          default:
            env.ENVIRONMENT = 'development';
            env.API_URL = opts.apiUrl ?? 'https://masteos-api-staging.herokuapp.com';
            break;
        }

        const results = {
          ios: null,
          android: null,
        };

        if (opts.ios) {
          results.ios = commands.push(
            await exec('yarn', computeBaseArguments('ios'), { env, silent: false })
          );
        }

        if (opts.android) {
          results.android = commands.push(
            await exec('yarn', computeBaseArguments('android'), { env, silent: false })
          );
        }

        return results;
      },
      removeDeployment: async (name, opts = { android: true, ios: true }) => {
        const commands = [];

        const computeBaseArguments = target => [
          'appcenter',
          'codepush',
          'deployment',
          'remove',
          '-a',
          codepushApp[target],
          '--quiet',
          name,
        ];

        if (opts.ios) {
          commands.push(exec('yarn', computeBaseArguments('ios')));
        }

        if (opts.android) {
          commands.push(exec('yarn', computeBaseArguments('android')));
        }

        return Promise.all(commands);
      },
    },
  };
};

module.exports = {
  Reactions,
  Gifs,
  useHelpers,
};
