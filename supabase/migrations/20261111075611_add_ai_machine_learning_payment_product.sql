alter table public.hynox_campus_payments
  drop constraint hynox_campus_payments_course_name_check,
  add constraint hynox_campus_payments_course_name_check check(course_name in (
    'AI & Machine Learning',
    'UI/UX Design',
    'Product Design',
    'D2C Mentorship',
    'Full Stack Dev',
    'Digital Marketing',
    'Management Consulting'
  ));
