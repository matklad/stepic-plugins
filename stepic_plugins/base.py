from importlib import import_module
import os

from . import schema
from .exceptions import UnknownPluginError


class BaseQuiz(object):
    name = None

    class Schemas:
        source = None
        reply = None
        dataset = None

    def __init__(self, source):
        assert self.name, '`name` attribute should be overridden in subclass'

    def clean_reply(self, reply, dataset):
        return reply

    def check(self, reply, clue):
        raise NotImplementedError

    def generate(self):
        return None

    def async_init(self):
        return None

    @classmethod
    def Source(cls, source):
        return schema.build(cls.Schemas.source, source)

    @classmethod
    def Reply(cls, reply):
        return schema.build(cls.Schemas.reply, reply)

    @classmethod
    def Dataset(cls, dataset):
        assert cls.Schemas.dataset is not None
        return schema.build(cls.Schemas.dataset, dataset)


def quiz_wrapper_factory(quiz_class):
    schemas = quiz_class.Schemas

    class QuizWrapper(object):
        wrapped_class = quiz_class

        def __init__(self, source, supplementary=None):
            source = schema.build(schemas.source, source)
            if supplementary is None:
                self.quiz = quiz_class(source)
            else:
                self.quiz = quiz_class(source, supplementary)

        def clean_reply(self, reply, dataset=None):
            reply = schema.build(schemas.reply, reply)
            if dataset:
                dataset = schema.build(schemas.dataset, dataset)
            return self.quiz.clean_reply(reply, dataset)

        def check(self, reply, clue=None):
            ret = self.quiz.check(reply, clue)
            if isinstance(ret, bool):
                score = ret
                hint = ''
            else:
                score, hint = ret
            assert isinstance(score, bool), 'Score should be True or False instead of {}'.format(score)
            assert isinstance(hint, str), 'hint should be a string instead of {}'.format(hint)
            return score, hint

        def generate(self):
            ret = self.quiz.generate()
            if ret:
                dataset, clue = ret
                schema.build(schemas.dataset, dataset)
            return ret

        def async_init(self):
            return self.quiz.async_init()

    return QuizWrapper


def load_by_name(name):
    """Dynamically loads plugin class by name"""

    base = os.path.join(os.path.dirname(__file__), 'quizzes')
    for directory in os.listdir(base):
        if os.path.isdir(os.path.join(base, directory)):
            package_name = os.path.basename(directory)
            qualified_name = 'stepic_plugins.quizzes.' + package_name
            module = import_module(qualified_name)
            for att in dir(module):
                val = getattr(module, att)
                if isinstance(val, type) and issubclass(val, BaseQuiz):
                    # noinspection PyUnresolvedReferences
                    if val.name == name:
                        return quiz_wrapper_factory(val)

    raise UnknownPluginError(name)
