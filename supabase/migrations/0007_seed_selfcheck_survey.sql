-- 삼성흉부외과 대전 — 증상 자가체크 설문 시드
--
-- 문항은 지어낸 것이 아니라 **구 사이트 원문**에서 가져왔다.
--   nvein_0302(하지정맥류의 증상·원인) / nvein_0303(합병증)
-- 증상 6개는 이미 사이트가 쓰고 있는 문구(lib/evidence.ts SYMPTOMS)를 그대로 옮겼다.
--
-- 상태는 'draft' 로 둔다. 내용을 확인한 뒤 관리자에서 '응답 받는 중' 으로 바꾸면
-- 그 순간 사이트 설문 탭에 뜬다.

insert into public.surveys (slug, title, intro, status, ask_contact, thanks)
values (
  'selfcheck',
  '하지정맥류 증상 자가체크',
  '겉으로 혈관이 보이지 않아도 하지정맥류일 수 있습니다. 해당하는 항목을 표시해 주세요. 진단을 대신하지 않으며, 정확한 확인은 초음파 검사가 필요합니다.',
  'draft',
  true,
  '응답해 주셔서 감사합니다. 남겨 주신 내용은 진료 상담에 참고합니다.'
)
on conflict (slug) do nothing;

-- 문항 — 이미 있으면 다시 넣지 않는다(여러 번 실행해도 안전)
insert into public.survey_questions (survey_id, ord, kind, label, options, required)
select s.id, v.ord, v.kind, v.label, v.options, v.required
from public.surveys s
cross join (values
  (1, 'multi',  '해당하는 증상을 모두 선택해 주세요',
   array[
     '다리가 쉽게 피곤하고 무겁게 느껴진다',
     '종아리가 자주 붓거나 저리고 당긴다',
     '밤에 자다가 다리에 쥐가 난다',
     '발목이 붓고 가렵거나 피부색이 변했다',
     '다리에 혈관이 튀어나와 보인다',
     '오래 서 있으면 다리 통증이 심해진다',
     '다리 통증과 함께 허리 통증이 있다',
     '해당하는 증상이 없다'
   ], true),

  (2, 'multi',  '피부에 나타난 변화가 있다면 선택해 주세요',
   array[
     '습진이나 피부 염증이 생겼다',
     '피부색이 어둡게 변했다(색소침착)',
     '피부가 헐거나 잘 아물지 않는 상처가 있다',
     '멍이 든 것처럼 보이는 부위가 있다',
     '해당 없음'
   ], false),

  (3, 'multi',  '해당하는 생활·신체 조건을 선택해 주세요',
   array[
     '가족 중에 하지정맥류가 있다',
     '오래 서 있거나 무거운 것을 드는 일을 한다',
     '임신·출산 경험이 있다',
     '변비가 잦다',
     '꼭 끼는 옷을 자주 입는다',
     '해당 없음'
   ], false),

  (4, 'scale',  '다리 증상이 일상생활에 주는 불편은 어느 정도인가요? (1 거의 없음 ~ 5 매우 심함)',
   array[]::text[], true),

  (5, 'single', '이전에 하지정맥류로 치료받은 적이 있나요?',
   array['없다', '있다 — 시술·수술을 받았다', '있다 — 약·압박스타킹만 했다'], true),

  (6, 'text',   '그 밖에 알려주고 싶은 내용이 있으면 적어 주세요',
   array[]::text[], false)
) as v(ord, kind, label, options, required)
where s.slug = 'selfcheck'
  and not exists (
    select 1 from public.survey_questions q
    where q.survey_id = s.id and q.ord = v.ord
  );

notify pgrst, 'reload schema';
