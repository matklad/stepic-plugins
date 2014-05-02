import requests
import time

from stepic_plugins.base import BaseQuiz
from stepic_plugins.exceptions import FormatError


class AdminQuiz(BaseQuiz):
    name = 'admin'

    rnr_api_url = 'http://rootnroll.com/api'
    #rnr_api_url = 'http://localhost:8000/api'
    rnr_stepic_username = 'stepic'
    rnr_stepic_password = 'stepic'
    rnr_checker_timeout = 60

    class Schemas:
        source = {
            'test_scenario': str,
            'task_title': str,
        }
        dataset = {
            'task_id': int,
        }
        reply = {
            'rnr_username': str
        }

    def __init__(self, source, supplementary=None):
        super().__init__(source)
        self.test_scenario = source.test_scenario
        self.task_title = source.task_title
        self.task_id = self._rnr_task_id(self.task_title)
        if self.task_id is None:  # This is a new quiz
            self._rnr_create_task(self.task_title)
            self.task_id = self._rnr_task_id(self.task_title)

    def _rnr_task_id(self, task_title):
        """Get rootnroll task id by task title."""
        try:
            r = requests.get('{0}/tasks/{1}'.format(self.rnr_api_url,
                                                    task_title))
        except requests.exceptions.RequestException as e:
            raise FormatError(e)
        if r.status_code == 200:
            return r.json()['id']
        elif r.status_code == 404:
            return None
        raise FormatError("Internal error in rnr platform")

    def _rnr_create_task(self, task_title):
        """Create new task on rootnroll platform."""
        try:
            r = requests.post('{0}/tasks'.format(self.rnr_api_url),
                              data={'title': task_title})
            if r.status_code != 201:
                raise FormatError("Cannot create new task on rnr platform")
        except requests.exceptions.RequestException as e:
            raise FormatError(e)

    def _rnr_run_checker(self, rnr_username):
        """Return result id."""
        try:
            r = requests.post('{0}/tasks/{1}/checker'.format(self.rnr_api_url,
                                                             self.task_id),
                              data={'test_scenario': self.test_scenario},
                              auth=(rnr_username, rnr_username + '_password'))
            if r.status_code == 202:
                return r.json()['result_id'], None
        except requests.exceptions.RequestException as e:
            pass
        return None, r.json().get('detail')

    def generate(self):
        dataset = {
            'task_id': self.task_id
        }
        clue = None
        return dataset, clue

    def clean_reply(self, reply, dataset):
        return reply

    def check(self, reply, clue):
        result_id, error = self._rnr_run_checker(reply.rnr_username)
        if result_id is None:
            return False, error
        start_time = time.time()
        while time.time() - start_time < self.rnr_checker_timeout:
            try:
                r = requests.get('{0}/tasks/{1}/checker/results/{2}'
                                 .format(self.rnr_api_url,
                                         self.task_id,
                                         result_id),
                                 auth=(self.rnr_stepic_username,
                                       self.rnr_stepic_password))
                if r.status_code == 200:
                    result = r.json().get('result')
                    if result == 'passed':
                        return True
                    elif result == 'failed':
                        return False, r.json().get('error_message')
            except requests.exceptions.RequestException as e:
                pass
            time.sleep(2)
        return False, "Timeout error"
