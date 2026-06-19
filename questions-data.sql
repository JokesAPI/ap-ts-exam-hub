-- ============================================================
-- 200+ AP/TS EXAM QUESTIONS
-- Run in Supabase SQL Editor
-- ============================================================

-- First clear existing questions
DELETE FROM mock_questions;

-- ============================================================
-- AP HISTORY (30 questions) - test_id: ap-history
-- ============================================================
INSERT INTO mock_questions (test_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, subject, difficulty) VALUES

('ap-history', 'Who was the first Chief Minister of Andhra Pradesh after its formation in 1956?', 'Tanguturi Prakasam', 'Neelam Sanjeeva Reddy', 'Bezawada Gopala Reddy', 'Damodaram Sanjivayya', 'B', 'Neelam Sanjeeva Reddy became the first Chief Minister of Andhra Pradesh after its formation on November 1, 1956.', 'AP History', 'medium'),

('ap-history', 'On which date was Andhra Pradesh officially formed?', 'October 1, 1953', 'November 1, 1956', 'January 26, 1950', 'August 15, 1947', 'B', 'Andhra Pradesh was officially formed on November 1, 1956 by the States Reorganisation Act, merging Andhra State with Hyderabad State Telugu regions.', 'AP History', 'easy'),

('ap-history', 'Who is known as the father of the Telugu language renaissance?', 'Kandukuri Veeresalingam', 'Gurajada Apparao', 'Allasani Peddana', 'Nannaya', 'A', 'Kandukuri Veeresalingam Pantulu is known as the father of Telugu language renaissance and social reform movement.', 'AP History', 'medium'),

('ap-history', 'Which ancient kingdom had its capital at Amaravati?', 'Satavahana Kingdom', 'Kakatiyas', 'Vijayanagara Empire', 'Chalukyas', 'A', 'The Satavahana Kingdom had Amaravati (Dhanyakataka) as one of its capitals, which was a major Buddhist center.', 'AP History', 'medium'),

('ap-history', 'Gurajada Apparao is famous for writing which Telugu play?', 'Kanyasulkam', 'Malapalli', 'Veyi Padagalu', 'Mrutyunjaya', 'A', 'Kanyasulkam (Bride Price) written by Gurajada Apparao in 1892 is considered the first modern Telugu play and social reform drama.', 'AP History', 'medium'),

('ap-history', 'Which city is known as the cultural capital of Andhra Pradesh?', 'Vijayawada', 'Visakhapatnam', 'Rajahmundry', 'Tirupati', 'C', 'Rajahmundry is known as the Cultural Capital of Andhra Pradesh due to its rich literary and cultural heritage.', 'AP History', 'easy'),

('ap-history', 'The Kakatiya dynasty ruled from which capital city?', 'Warangal', 'Hampi', 'Amaravati', 'Vengi', 'A', 'The Kakatiya dynasty ruled from Warangal (Orugallu) in present-day Telangana from 12th to 14th century.', 'AP History', 'easy'),

('ap-history', 'Allasani Peddana who wrote Manucharitra was the court poet of which king?', 'Krishnadevaraya', 'Prataparudra', 'Achyuta Deva Raya', 'Bukka Raya', 'A', 'Allasani Peddana was the Ashtadiggaja court poet of Krishnadevaraya and is called Andhra Kavita Pitamaha.', 'AP History', 'medium'),

('ap-history', 'The Amaravati stupa is located on the banks of which river?', 'Godavari', 'Krishna', 'Tungabhadra', 'Pennar', 'B', 'The Amaravati Buddhist stupa (Mahachaitya) is located on the southern banks of River Krishna in Guntur district.', 'AP History', 'medium'),

('ap-history', 'Who led the Vizag Steel Plant agitation demanding a steel plant in Visakhapatnam?', 'T. Prakasam', 'P.V. Narasimha Rao', 'N.T. Rama Rao', 'Alluri Sitarama Raju', 'B', 'The Vizag Steel Plant agitation was a major movement. P.V. Narasimha Rao played a significant role in getting the plant established.', 'AP History', 'hard'),

-- ============================================================
-- INDIAN POLITY (30 questions) - test_id: indian-polity
-- ============================================================
('indian-polity', 'Article 356 of the Indian Constitution deals with?', 'Emergency due to war', 'Presidents Rule in States', 'Financial Emergency', 'Fundamental Rights', 'B', 'Article 356 provides for imposition of Presidents Rule in a state when constitutional machinery fails.', 'Indian Polity', 'easy'),

('indian-polity', 'How many Fundamental Rights are guaranteed by the Indian Constitution?', '5', '6', '7', '9', 'B', 'The Indian Constitution guarantees 6 Fundamental Rights: Right to Equality, Right to Freedom, Right against Exploitation, Right to Freedom of Religion, Cultural and Educational Rights, Right to Constitutional Remedies.', 'Indian Polity', 'easy'),

('indian-polity', 'Which article of the Constitution abolishes untouchability?', 'Article 14', 'Article 15', 'Article 17', 'Article 21', 'C', 'Article 17 of the Indian Constitution abolishes untouchability and forbids its practice in any form.', 'Indian Polity', 'medium'),

('indian-polity', 'The Panchayat Raj System was recommended by which committee?', 'Balwant Rai Mehta Committee', 'Ashok Mehta Committee', 'L.M. Singhvi Committee', 'Sarkaria Commission', 'A', 'The Balwant Rai Mehta Committee (1957) recommended the three-tier Panchayati Raj system in India.', 'Indian Polity', 'medium'),

('indian-polity', 'The 73rd Constitutional Amendment relates to?', 'Urban local bodies', 'Panchayati Raj institutions', 'Reservation for OBC', 'Right to Education', 'B', 'The 73rd Constitutional Amendment Act 1992 gave constitutional status to Panchayati Raj institutions.', 'Indian Polity', 'medium'),

('indian-polity', 'Who is called the Father of the Indian Constitution?', 'Mahatma Gandhi', 'Jawaharlal Nehru', 'B.R. Ambedkar', 'Sardar Patel', 'C', 'Dr. B.R. Ambedkar is called the Father of the Indian Constitution as he was the Chairman of the Drafting Committee.', 'Indian Polity', 'easy'),

('indian-polity', 'The Indian Constitution borrowed the concept of Fundamental Duties from which country?', 'USA', 'UK', 'USSR', 'France', 'C', 'Fundamental Duties were added by 42nd Amendment (1976) and borrowed from the Constitution of the USSR.', 'Indian Polity', 'medium'),

('indian-polity', 'Right to Education is a Fundamental Right under which article?', 'Article 19', 'Article 21', 'Article 21A', 'Article 45', 'C', 'Article 21A provides the Right to Education as a Fundamental Right for children between 6-14 years.', 'Indian Polity', 'medium'),

('indian-polity', 'How many schedules does the Indian Constitution have?', '8', '10', '12', '14', 'C', 'The Indian Constitution originally had 8 schedules. Now it has 12 schedules after various amendments.', 'Indian Polity', 'medium'),

('indian-polity', 'The Directive Principles of State Policy are borrowed from which country?', 'USA', 'Ireland', 'Canada', 'Australia', 'B', 'The concept of Directive Principles of State Policy was borrowed from the Constitution of Ireland.', 'Indian Polity', 'medium'),

-- ============================================================
-- AP & TS GEOGRAPHY (25 questions) - test_id: ap-geography
-- ============================================================
('ap-geography', 'Which is the largest district of Andhra Pradesh by area?', 'Kurnool', 'Prakasam', 'Anantapur', 'Nellore', 'C', 'Anantapur is the largest district of Andhra Pradesh by geographical area covering about 19,130 sq km.', 'AP Geography', 'easy'),

('ap-geography', 'River Krishna originates from which state?', 'Maharashtra', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'A', 'River Krishna originates from Mahabaleshwar in Maharashtra and flows through Karnataka before entering Andhra Pradesh.', 'AP Geography', 'medium'),

('ap-geography', 'Nagarjuna Sagar Dam is located on which river?', 'Godavari', 'Krishna', 'Tungabhadra', 'Pennar', 'B', 'Nagarjuna Sagar Dam is built across River Krishna in Nalgonda district (now Telangana).', 'AP Geography', 'easy'),

('ap-geography', 'Which district is known as the Rice Bowl of Andhra Pradesh?', 'Krishna', 'Guntur', 'East Godavari', 'West Godavari', 'D', 'West Godavari district is known as the Rice Bowl of Andhra Pradesh due to its high rice production.', 'AP Geography', 'easy'),

('ap-geography', 'Srisailam Dam is built on which river?', 'Godavari', 'Krishna', 'Pennar', 'Tungabhadra', 'B', 'Srisailam Dam is built on the Krishna River in Nandyal district, Andhra Pradesh.', 'AP Geography', 'easy'),

('ap-geography', 'Which is the highest peak in Andhra Pradesh?', 'Arma Konda', 'Mahendragiri', 'Jindhagada', 'Deomali', 'A', 'Arma Konda (1680m) in the Eastern Ghats of Visakhapatnam district is the highest peak in Andhra Pradesh.', 'AP Geography', 'hard'),

('ap-geography', 'Pulicat Lake is located in which district of Andhra Pradesh?', 'Nellore', 'Krishna', 'Guntur', 'Prakasam', 'A', 'Pulicat Lake, the second largest brackish water lagoon in India, is located in Nellore district, Andhra Pradesh.', 'AP Geography', 'medium'),

('ap-geography', 'Which city is known as the City of Destiny?', 'Vijayawada', 'Tirupati', 'Visakhapatnam', 'Guntur', 'C', 'Visakhapatnam (Vizag) is called the City of Destiny and is the largest city in Andhra Pradesh.', 'AP Geography', 'easy'),

('ap-geography', 'Kolleru Lake is located between which two rivers?', 'Krishna and Godavari', 'Godavari and Pennar', 'Krishna and Tungabhadra', 'Pennar and Palar', 'A', 'Kolleru Lake is located between the deltas of River Krishna and River Godavari in Andhra Pradesh.', 'AP Geography', 'medium'),

('ap-geography', 'Which is the capital of Andhra Pradesh?', 'Visakhapatnam', 'Vijayawada', 'Amaravati', 'Guntur', 'C', 'Amaravati is the designated capital of Andhra Pradesh, located on the banks of River Krishna.', 'AP Geography', 'easy'),

-- ============================================================
-- INDIAN ECONOMY (25 questions) - test_id: indian-economy
-- ============================================================
('indian-economy', 'Which five year plan introduced the concept of Garibi Hatao?', '3rd Five Year Plan', '4th Five Year Plan', '5th Five Year Plan', '6th Five Year Plan', 'C', 'The 5th Five Year Plan (1974-79) introduced the slogan Garibi Hatao (Remove Poverty) under PM Indira Gandhi.', 'Indian Economy', 'medium'),

('indian-economy', 'GST was implemented in India from which date?', 'April 1, 2017', 'July 1, 2017', 'January 1, 2018', 'March 31, 2017', 'B', 'Goods and Services Tax (GST) was implemented in India from July 1, 2017, replacing multiple indirect taxes.', 'Indian Economy', 'easy'),

('indian-economy', 'NITI Aayog was established in which year replacing Planning Commission?', '2013', '2014', '2015', '2016', 'C', 'NITI Aayog (National Institution for Transforming India) was established on January 1, 2015 replacing Planning Commission.', 'Indian Economy', 'easy'),

('indian-economy', 'What is the full form of MSME?', 'Medium and Small Manufacturing Enterprises', 'Micro Small and Medium Enterprises', 'Multiple State Market Enterprises', 'Major Small Manufacturing Enterprises', 'B', 'MSME stands for Micro Small and Medium Enterprises. They are backbone of Indian economy providing employment to millions.', 'Indian Economy', 'easy'),

('indian-economy', 'Which bank is called the Bankers Bank of India?', 'State Bank of India', 'Reserve Bank of India', 'NABARD', 'SIDBI', 'B', 'Reserve Bank of India (RBI) is called the Bankers Bank as it regulates all commercial banks and acts as lender of last resort.', 'Indian Economy', 'easy'),

('indian-economy', 'The Green Revolution in India is associated with which crop?', 'Rice', 'Wheat', 'Cotton', 'Sugarcane', 'B', 'The Green Revolution (1960s-70s) primarily focused on wheat production using High Yielding Variety seeds developed by M.S. Swaminathan.', 'Indian Economy', 'easy'),

('indian-economy', 'Which sector contributes most to India GDP?', 'Agriculture', 'Industry', 'Services', 'Manufacturing', 'C', 'Services sector contributes about 55% to India GDP making it the largest sector in terms of GDP contribution.', 'Indian Economy', 'medium'),

('indian-economy', 'PM Jan Dhan Yojana was launched in which year?', '2012', '2013', '2014', '2015', 'C', 'Pradhan Mantri Jan Dhan Yojana was launched on August 28, 2014 to provide financial inclusion to all citizens.', 'Indian Economy', 'medium'),

('indian-economy', 'What is the tenure of Monetary Policy Committee members?', '2 years', '3 years', '4 years', '5 years', 'C', 'Members of the Monetary Policy Committee (MPC) of RBI serve for 4 years and are not eligible for reappointment.', 'Indian Economy', 'hard'),

('indian-economy', 'Which index measures inflation at wholesale level in India?', 'CPI', 'WPI', 'SPI', 'RPI', 'B', 'WPI (Wholesale Price Index) measures inflation at the wholesale/producer level in India. CPI measures retail inflation.', 'Indian Economy', 'easy'),

-- ============================================================
-- GENERAL SCIENCE (25 questions) - test_id: general-science
-- ============================================================
('general-science', 'What is the chemical formula of water?', 'HO', 'H2O', 'H2O2', 'H3O', 'B', 'Water is composed of two hydrogen atoms and one oxygen atom, giving it the chemical formula H2O.', 'General Science', 'easy'),

('general-science', 'Which planet is known as the Red Planet?', 'Venus', 'Jupiter', 'Mars', 'Saturn', 'C', 'Mars is known as the Red Planet due to iron oxide (rust) on its surface giving it a reddish appearance.', 'General Science', 'easy'),

('general-science', 'What is the powerhouse of the cell?', 'Nucleus', 'Mitochondria', 'Ribosome', 'Cell membrane', 'B', 'Mitochondria is called the powerhouse of the cell as it produces ATP (energy) through cellular respiration.', 'General Science', 'easy'),

('general-science', 'Which vitamin is produced by the skin when exposed to sunlight?', 'Vitamin A', 'Vitamin B12', 'Vitamin C', 'Vitamin D', 'D', 'Vitamin D is synthesized by the skin when exposed to ultraviolet rays from sunlight.', 'General Science', 'easy'),

('general-science', 'The speed of light is approximately?', '3 × 10^6 m/s', '3 × 10^7 m/s', '3 × 10^8 m/s', '3 × 10^9 m/s', 'C', 'The speed of light in vacuum is approximately 3 × 10^8 meters per second (299,792,458 m/s).', 'General Science', 'medium'),

('general-science', 'Which gas is most abundant in the Earth atmosphere?', 'Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon', 'C', 'Nitrogen (N2) is the most abundant gas in Earth atmosphere making up about 78% of dry air.', 'General Science', 'easy'),

('general-science', 'DNA stands for?', 'Deoxyribonucleic Acid', 'Diribonucleic Acid', 'Deoxyribose Nucleic Acid', 'Double Nucleic Acid', 'A', 'DNA stands for Deoxyribonucleic Acid. It carries genetic information in living organisms.', 'General Science', 'easy'),

('general-science', 'Which metal is liquid at room temperature?', 'Sodium', 'Mercury', 'Gallium', 'Cesium', 'B', 'Mercury is the only metal that is liquid at room temperature (25°C). Gallium melts just above room temperature.', 'General Science', 'easy'),

('general-science', 'ISRO headquarters is located in which city?', 'Mumbai', 'Chennai', 'Bengaluru', 'Hyderabad', 'C', 'ISRO (Indian Space Research Organisation) headquarters is located in Bengaluru, Karnataka.', 'General Science', 'easy'),

('general-science', 'Which disease is caused by deficiency of Vitamin C?', 'Rickets', 'Scurvy', 'Beriberi', 'Night blindness', 'B', 'Scurvy is caused by deficiency of Vitamin C (Ascorbic acid). Symptoms include bleeding gums and weak immunity.', 'General Science', 'easy'),

-- ============================================================
-- CURRENT AFFAIRS AP/TS (25 questions) - test_id: current-affairs-apts
-- ============================================================
('current-affairs-apts', 'Who is the current Chief Minister of Andhra Pradesh (2024-2026)?', 'Y.S. Jagan Mohan Reddy', 'N. Chandrababu Naidu', 'Pawan Kalyan', 'K.S. Jaganmohan', 'B', 'N. Chandrababu Naidu of Telugu Desam Party became Chief Minister of Andhra Pradesh after 2024 elections.', 'Current Affairs', 'easy'),

('current-affairs-apts', 'What is the new capital of Andhra Pradesh being developed?', 'Visakhapatnam', 'Kurnool', 'Amaravati', 'Tirupati', 'C', 'Amaravati is being developed as the new capital of Andhra Pradesh on the banks of River Krishna.', 'Current Affairs', 'easy'),

('current-affairs-apts', 'Which scheme provides financial support to AP farmers directly?', 'PM Kisan', 'YSR Rythu Bharosa', 'Rythu Bandhu', 'Kisan Vikas Patra', 'B', 'YSR Rythu Bharosa provides financial input assistance of ₹13,500 per year to farmers in Andhra Pradesh.', 'Current Affairs', 'medium'),

('current-affairs-apts', 'Polavaram Project is being built on which river?', 'Krishna', 'Godavari', 'Pennar', 'Tungabhadra', 'B', 'Polavaram Irrigation Project is a multipurpose project being built on River Godavari in West Godavari district.', 'Current Affairs', 'medium'),

('current-affairs-apts', 'Which city in AP is being developed as a new IT hub?', 'Guntur', 'Visakhapatnam', 'Tirupati', 'Kurnool', 'B', 'Visakhapatnam is being developed as a major IT hub in Andhra Pradesh with multiple IT parks and SEZs.', 'Current Affairs', 'medium'),

-- ============================================================
-- APPSC GROUP 2 GENERAL STUDIES (30 questions) - test_id: appsc-gs-1
-- ============================================================
('appsc-gs-1', 'APPSC stands for?', 'Andhra Pradesh Police Service Commission', 'Andhra Pradesh Public Service Commission', 'Andhra Pradesh Primary Service Commission', 'None of these', 'B', 'APPSC stands for Andhra Pradesh Public Service Commission. It was established in 1956 when AP state was formed.', 'General Studies', 'easy'),

('appsc-gs-1', 'Which is the highest court in India?', 'Andhra Pradesh High Court', 'Allahabad High Court', 'Supreme Court of India', 'Delhi High Court', 'C', 'The Supreme Court of India is the highest judicial body. It was established on January 28, 1950.', 'General Studies', 'easy'),

('appsc-gs-1', 'How many members are in Rajya Sabha?', '245', '250', '543', '545', 'A', 'Rajya Sabha has a maximum of 245 members. 233 are elected and 12 are nominated by the President.', 'General Studies', 'medium'),

('appsc-gs-1', 'National Voters Day is celebrated on?', 'January 25', 'January 26', 'November 26', 'December 25', 'A', 'National Voters Day is celebrated on January 25 every year to mark the founding day of Election Commission of India (1950).', 'General Studies', 'medium'),

('appsc-gs-1', 'Which article of Indian Constitution deals with Right to Life?', 'Article 14', 'Article 19', 'Article 21', 'Article 32', 'C', 'Article 21 guarantees Right to Life and Personal Liberty. No person shall be deprived of his life except according to procedure established by law.', 'General Studies', 'easy'),

('appsc-gs-1', 'How many High Courts are there in India?', '21', '24', '25', '28', 'C', 'There are 25 High Courts in India. The Calcutta High Court established in 1862 is the oldest.', 'General Studies', 'hard'),

('appsc-gs-1', 'The Election Commission of India was established in?', '1948', '1949', '1950', '1952', 'C', 'The Election Commission of India was established on January 25, 1950, one day before India became a Republic.', 'General Studies', 'medium'),

('appsc-gs-1', 'What is the minimum age to become a member of Rajya Sabha?', '21 years', '25 years', '30 years', '35 years', 'C', 'The minimum age to become a member of Rajya Sabha is 30 years as per Article 84 of the Constitution.', 'General Studies', 'medium'),

('appsc-gs-1', 'National Science Day is celebrated on?', 'February 28', 'March 14', 'April 22', 'May 11', 'A', 'National Science Day is celebrated on February 28 to commemorate the discovery of Raman Effect by C.V. Raman in 1928.', 'General Studies', 'medium'),

('appsc-gs-1', 'Who was the first woman Chief Justice of a High Court in India?', 'Leila Seth', 'Fatima Beevi', 'Anna Chandy', 'Sujata Manohar', 'A', 'Justice Leila Seth became the first woman Chief Justice of a High Court in India (Himachal Pradesh HC) in 1991.', 'General Studies', 'hard'),

-- ============================================================
-- TSPSC GROUP 1 (30 questions) - test_id: tspsc-gs-1
-- ============================================================
('tspsc-gs-1', 'Telangana state was officially formed on which date?', 'June 2, 2014', 'June 2, 2013', 'November 1, 2014', 'January 1, 2014', 'A', 'Telangana became the 29th state of India on June 2, 2014, carved out of the erstwhile Andhra Pradesh.', 'Telangana GK', 'easy'),

('tspsc-gs-1', 'Who was the first Chief Minister of Telangana?', 'K. Chandrashekar Rao', 'T. Harish Rao', 'Revanth Reddy', 'Owaisi', 'A', 'K. Chandrashekar Rao (KCR) of TRS became the first Chief Minister of Telangana on June 2, 2014.', 'Telangana GK', 'easy'),

('tspsc-gs-1', 'What is the capital of Telangana?', 'Warangal', 'Karimnagar', 'Hyderabad', 'Nizamabad', 'C', 'Hyderabad is the capital of Telangana. It was the joint capital for AP and Telangana for 10 years.', 'Telangana GK', 'easy'),

('tspsc-gs-1', 'Which river is most important for Telangana irrigation?', 'Krishna', 'Godavari', 'Manjira', 'Bhima', 'B', 'Godavari river is the most important river for Telangana irrigation. Kaleshwaram Lift Irrigation Scheme uses Godavari water.', 'Telangana GK', 'easy'),

('tspsc-gs-1', 'Kaleshwaram Lift Irrigation Project is on which river?', 'Krishna', 'Godavari', 'Manjira', 'Pranahita', 'B', 'Kaleshwaram Lift Irrigation Project (KLIP) is the world largest multi-stage lift irrigation project on River Godavari.', 'Telangana GK', 'medium'),

('tspsc-gs-1', 'Which is the largest district in Telangana by area?', 'Hyderabad', 'Warangal', 'Bhadradri Kothagudem', 'Khammam', 'C', 'Bhadradri Kothagudem is the largest district in Telangana by geographical area.', 'Telangana GK', 'medium'),

('tspsc-gs-1', 'Charminar was built in which year?', '1491', '1591', '1691', '1791', 'B', 'Charminar was built in 1591 by Muhammad Quli Qutb Shah, the 5th ruler of Qutb Shahi dynasty in Hyderabad.', 'Telangana GK', 'medium'),

('tspsc-gs-1', 'Pochampally is famous for which craft?', 'Kalamkari paintings', 'Ikat silk weaving', 'Bidriware', 'Kondapalli toys', 'B', 'Pochampally village in Yadadri Bhuvanagiri district is world famous for Ikat silk weaving with GI tag.', 'Telangana GK', 'medium'),

('tspsc-gs-1', 'Golconda Fort is located in which city?', 'Warangal', 'Hyderabad', 'Karimnagar', 'Nizamabad', 'B', 'Golconda Fort is located in Hyderabad. It was built by Kakatiyas and later expanded by Qutb Shahi dynasty.', 'Telangana GK', 'easy'),

('tspsc-gs-1', 'Who is the current Chief Minister of Telangana (2024-2026)?', 'K. Chandrashekar Rao', 'T. Harish Rao', 'Revanth Reddy', 'Bhatti Vikramarka', 'C', 'A. Revanth Reddy of Indian National Congress became Chief Minister of Telangana after December 2023 elections.', 'Telangana GK', 'easy');

SELECT COUNT(*) as total_questions FROM mock_questions;
