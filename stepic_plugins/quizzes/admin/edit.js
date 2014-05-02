function editAdminQuiz(target, template, source) {
  // `source` will be null if it is a new quiz.
  source = source || {
    test_scenario: '',
    // unique rnr task title
    task_title: 'stepic-' + (new Date()).getTime()
  };
  // render Handlebars template and insert it into target
  target.html(template(source));

  // return an object with a `submit` method.
  // `submit` returns a source, conforming to SimpleChoiceQuiz.Schemas.source
  return {
    'submit': function () {
      source.test_scenario = target.find('.test_scenario').val()
      return source;
    }
  };
}
