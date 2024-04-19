import moment from 'moment';

export const formatDate = (dateString) => {
  return moment(dateString).locale('ru').format('D MMMM HH:mm');
}

export const isValidTimezone = (text) => {
    const timezoneRegex = /^[+-]\d+$/;
    return timezoneRegex.test(text);
}