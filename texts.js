export const HELLO_TEXT = `Привет! Я бот для отмечания эмоций. Я дам тебе список возможных эмоций, а ты сможешь выбрать те, которые наиболее близки к твоему текущему состоянию\n\nНажми /newcheckup для новой записи и выбери до 5 пунктов из списка одной или разных категорий\n\nНазвать свои эмоции - уже большой шаг в рефлексии. А после ты сможешь посмотреть статистику за все время. Советую обращаться ко мне 3-4 раза в день`;

export const getCurrentChoicesConfirmText = (choices) => {
    return `Текущий выбор: ${choices.join(', ')}

${choices.length < 5 ? `Выбери еще до ${5 - choices.length} или ` : ''}нажми /complete, чтобы сохранить результат.
    
Отменить выбор можно повторным нажатием`
}

export const ASK_FOR_TIMEZONE_TEXT = "Пожалуйста, введи свой часовой пояс в формате UTC (например, '+3' для Москвы или '+8' для Бали). Это поможет мне не беспокоить тебя в ночное время. Отправь '-' если не хочешь получать напоминания или ничего не отвечай)."