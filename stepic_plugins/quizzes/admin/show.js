function showAdminQuiz(target, template, dataset, reply, disabled) {
// Create a fake App if this plugin is used in a sandbox
  if (typeof App === 'undefined') {
    App = {user: {id: 123}};
  }
  var rnr_api_url = 'http://rootnroll.com/api',  // ! USE THIS IN PRODUCTION
      //rnr_api_url = 'http://localhost:8000/api',
      rnr_stepic_username = 'stepic',
      rnr_stepic_password = 'stepic',
      rnr_username = App.user.id.toString(),
      rnr_password = rnr_username + '_password',
      rnr_user_created = false,
      rnr_task_id = dataset.task_id,
      server_stable_statuses = ['NOT CREATED', 'ERROR', 'ACTIVE', 'SHUTOFF'],
      context = {
        show_server: false,
        controls: {
          server_power: {
            on: false,
            disabled: true
          },
          terminal_switch: {
            on: false,
            disabled: false,
            visible: false
          }
        },
        server: {},
        terminal: null
      };

  var basicAuthHeader = function (username, password) {
    return {
      "Authorization": "Basic " + btoa(username + ':' + password)
    }
  };

  var createRnrUser = function (username, password) {
    data = {
      username: username,
      password: password
    };
    $.ajax(rnr_api_url + '/users', {
      type: 'post',
      headers: basicAuthHeader(rnr_stepic_username, rnr_stepic_password),
      data: JSON.stringify(data),
      contentType: 'application/json'
    }).done(function (data) {
      rnr_user_created = true;
    }).fail(function (jqXHR) {
      if (jqXHR.status === 400) {
        // FAIL means the uses exists => OK
        rnr_user_created = true;
      }
    });
  };

  var loadQuizRequirements = function () {
    $.getScript('http://rootnroll.com/static/bower_components/term.js/src/term.js', function () {
      $.getScript('http://rootnroll.com/static/bower_components/tty.js/static/tty.js', function () {
        tty.on('open window', function (window) {
          context.controls.terminal_switch.on = true;
          context.terminal = window;
        });
        tty.on('close window', function () {
          context.controls.terminal_switch.on = false;
          context.terminal = null;
        });
      });
    });
    $.getScript('http://rootnroll.com/static/bower_components/sockjs/sockjs.min.js');
    $.getScript('http://rootnroll.com/static/bower_components/js-base64/base64.min.js');
    $('head').append($('<link rel="stylesheet" type="text/css" />')
                     .attr('href', 'http://rootnroll.com/static/bower_components/tty.js/static/stepic-style.css'))
             .append($('<link rel="stylesheet" type="text/css" />')
                     .attr('href', 'http://netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.css'));
  };

  var updateServerView = function () {
    target.html(template(context));
    target.find('[data-action=server-power]').on('click', function () {
      if (context.controls.server_power.on) {
        destroyServer();
      } else {
        startServer();
      }
    });
    target.find('[data-action=terminal-switch]').on('click', function () {
      if (context.controls.terminal_switch.on) {
        closeTerminal();
      } else {
        openTerminal();
      }
    });
  };

  var startServer = function () {
    context.controls.server_power.disabled = true;
    updateServerView();
    $.ajax(rnr_api_url + '/tasks/' + rnr_task_id + '/server', {
      type: 'post',
      headers: basicAuthHeader(rnr_username, rnr_password),
      contentType: 'application/json'
    }).fail(function (jqXHR) {
      console.error("Cannot start new rnr server")
    });
  };

  var destroyServer = function () {
    context.controls.server_power.disabled = true;
    context.controls.terminal_switch.visible = false;
    updateServerView();
    $.ajax(rnr_api_url + '/tasks/' + rnr_task_id + '/server', {
      type: 'delete',
      headers: basicAuthHeader(rnr_username, rnr_password),
      contentType: 'application/json'
    }).fail(function (jqXHR) {
      console.error("Cannot destroy rnr server")
    });
  };

  var getTerminal = function (success, fail) {
    $.ajax(rnr_api_url + '/tasks/' + rnr_task_id + '/server/terminal', {
      type: 'get',
      headers: basicAuthHeader(rnr_username, rnr_password),
      contentType: 'application/json'
    }).done(success)
      .fail(fail);
  };

  var createTerminal = function (success) {
    $.ajax(rnr_api_url + '/tasks/' + rnr_task_id + '/server/terminal', {
      type: 'post',
      headers: basicAuthHeader(rnr_username, rnr_password),
      contentType: 'application/json'
    }).done(function () {
      getTerminal(success, function () {});
    }).fail(function (jqXHR) {
      console.error("Cannot create new rnr terminal");
      context.controls.terminal_switch.disabled = false;
      updateServerView();
    });
  };

  var openTerminal = function () {
    context.controls.terminal_switch.disabled = true;
    updateServerView();
    getTerminal(openTerminalWindow, function () {
      console.log("Get terminal: fail");
      createTerminal(openTerminalWindow);
    });
  };

  var openTerminalWindow = function (terminal) {
    console.log("Connecting to: '" + terminal.kaylee_url + "' terminal id: " + terminal.id);
    context.controls.terminal_switch.disabled = false;
    updateServerView();
    tty.open(terminal.kaylee_url, terminal.id);
  };

  var closeTerminal = function () {
    if (context.terminal) {
      context.terminal.destroy();
    }
  };

  createRnrUser(rnr_username, rnr_password);
  loadQuizRequirements();

  (function pollServer() {
    if (rnr_user_created) {
      $.ajax(rnr_api_url + '/tasks/' + rnr_task_id + '/server', {
        type: 'get',
        headers: basicAuthHeader(rnr_username, rnr_password),
        contentType: 'application/json'
      }).done(function (data) {
        context.show_server = true;
        context.controls.server_power.disabled = false;
        context.controls.terminal_switch.visible = data.status === 'ACTIVE';
        context.controls.server_power.on = data.status !== 'NOT CREATED';
        context.server = data;
        if (server_stable_statuses.indexOf(data.status) === -1) {
          context.server.loading = true;
        }
        updateServerView();
      });
    }
    setTimeout(pollServer, 2000);
  })();

  // return an object with `submit` method, which returns reply
  // conforming to AdminQuiz.Schemas.reply
  return {
    'submit': function () {
      return {
        'rnr_username': rnr_username
      };
    }
  };
}
