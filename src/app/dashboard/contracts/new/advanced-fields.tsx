export function ContractAdvancedFields() {
  return (
    <>
      <label className="grid gap-1 text-sm font-medium">
        상품 유형
        <select name="productType" defaultValue="daytrip" className="rounded border px-3 py-2">
          <option value="daytrip">당일 이용</option>
          <option value="workshop">워크숍</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">담당자 직함<input name="contactTitle" className="rounded border px-3 py-2" /></label>
      <label className="grid gap-1 text-sm font-medium">세미나 시작<input name="seminarStart" type="time" className="rounded border px-3 py-2" /></label>
      <label className="grid gap-1 text-sm font-medium">세미나 종료<input name="seminarEnd" type="time" className="rounded border px-3 py-2" /></label>
      <label className="grid gap-1 text-sm font-medium">세미나 시간<input name="seminarHours" type="number" min="0" className="rounded border px-3 py-2" /></label>
      <label className="grid gap-1 text-sm font-medium">얼리 사용 시작<input name="earlyUseStart" type="time" className="rounded border px-3 py-2" /></label>
      <label className="grid gap-1 text-sm font-medium">얼리 사용 시간<input name="earlyUseHours" type="number" min="0" className="rounded border px-3 py-2" /></label>
      <label className="grid gap-1 text-sm font-medium">얼리 사용 인원<input name="earlyUsePeople" type="number" min="0" className="rounded border px-3 py-2" /></label>
      <label className="grid gap-1 text-sm font-medium">할인 금액<input name="discountAmount" type="number" min="0" className="rounded border px-3 py-2" /></label>
      <label className="grid gap-1 text-sm font-medium">할인 사유<input name="discountReason" className="rounded border px-3 py-2" /></label>
      <fieldset className="grid gap-2 sm:col-span-2"><legend className="text-sm font-medium">추가 객실</legend>{[0, 1, 2].map((index) => <div key={index} className="grid gap-2 sm:grid-cols-4"><input name={`roomName${index}`} placeholder="객실명" className="rounded border px-3 py-2 text-sm" /><input name={`roomCount${index}`} type="number" min="0" placeholder="수량" className="rounded border px-3 py-2 text-sm" /><input name={`roomPrice${index}`} type="number" min="0" placeholder="단가" className="rounded border px-3 py-2 text-sm" /><input name={`roomNote${index}`} placeholder="메모" className="rounded border px-3 py-2 text-sm" /></div>)}</fieldset>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input name="blankIssueConfirmed" type="checkbox" /> 빈 항목 발행을 확인했습니다.</label>
    </>
  );
}
