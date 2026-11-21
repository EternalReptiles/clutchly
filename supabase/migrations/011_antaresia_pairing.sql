-- Antaresia pair on 1 June, like carpets (southern hemisphere; shifted for the north by the app).
update species_templates set pair_start = '06-01',
  notes = 'Paired after a month without food to clear out. Pre-lay shed to lay is usually 20-28 days.', updated_at = now()
where species = 'Antaresia';
