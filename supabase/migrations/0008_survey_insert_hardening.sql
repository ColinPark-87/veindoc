-- 삼성흉부외과 대전 — 설문 응답 삽입 조이기
--
-- 발견한 문제: 공개 키는 클라이언트 번들에 들어 있으므로 누구나 서버 액션을 건너뛰고
-- REST 로 survey_responses 에 직접 INSERT 할 수 있었다(실제로 201 을 받았다).
-- 서버 액션의 검증은 폼 경로만 지키고 API 경로는 못 지킨다. 검증을 DB 로 내린다.
--
-- 한계도 적어 둔다: 이 정책은 '이상한 내용'을 막지만 '많은 양'은 못 막는다.
-- 대량 제출은 Vercel 쪽(WAF·BotID)에서 다뤄야 한다.

create or replace function public.survey_answers_valid(p_survey uuid, p_answers jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select jsonb_typeof(p_answers) = 'object'
     and pg_column_size(p_answers) < 8192          -- 한 응답이 8KB 를 넘을 이유가 없다
     and not exists (                              -- 그 설문의 문항이 아닌 키가 섞이면 거부
       select 1
       from jsonb_object_keys(p_answers) as k
       where k not in (
         select q.id::text from public.survey_questions q where q.survey_id = p_survey
       )
     );
$$;

drop policy if exists "sr anon insert" on public.survey_responses;
create policy "sr anon insert" on public.survey_responses
  for insert with check (
    exists (select 1 from public.surveys s
            where s.id = survey_id and s.status = 'open')
    and public.survey_answers_valid(survey_id, answers)
    and length(coalesce(name, ''))  <= 40
    and length(coalesce(phone, '')) <= 11
    and phone ~ '^[0-9]*$'                          -- 숫자만
  );

-- 점검하며 넣은 시험 응답 정리
delete from public.survey_responses
where name = 'RT'
   or answers ? '없는문항'
   or name = '검수';

notify pgrst, 'reload schema';
