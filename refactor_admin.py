import re
import sys

def main():
    with open('src/app/admin/admin-panel.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Imports
    content = content.replace(
        'import { useCache } from "@/components/cache-provider";',
        '''import { useCache } from "@/components/cache-provider";
import { usePrograms, useTenantInstructors, useCourses, useCourseModules, useCourseInstructors, useAcademicLookups } from "@/hooks/use-academics";'''
    )

    # States
    content = re.sub(r'const \[acadPrograms, setAcadPrograms\] = useState<any\[\]>\(\[\]\);', r'const { data: acadPrograms = [] } = usePrograms(acadSelectedInstId);', content)
    content = re.sub(r'const \[acadCourses, setAcadCourses\] = useState<any\[\]>\(\[\]\);', r'const { data: acadCourses = [] } = useCourses(acadSelectedProgram?.id);', content)
    content = re.sub(r'const \[acadModules, setAcadModules\] = useState<any\[\]>\(\[\]\);', r'const { data: acadModules = [] } = useCourseModules(acadSelectedCourse?.id);', content)
    content = re.sub(r'const \[acadInstructors, setAcadInstructors\] = useState<any\[\]>\(\[\]\);', r'const { data: acadInstructors = [] } = useCourseInstructors(acadSelectedCourse?.id);', content)
    content = re.sub(r'const \[acadTenantTeachers, setAcadTenantTeachers\] = useState<any\[\]>\(\[\]\);', r'const { data: acadTenantTeachers = [] } = useTenantInstructors(acadSelectedInstId);', content)
    content = re.sub(r'const \[acadLookups, setAcadLookups\] = useState<any>\([^)]+\);', r'const { data: acadLookups = { courseTypes: [], lessonTypes: [], statuses: [], visibilityTypes: [] } } = useAcademicLookups();', content)

    # Since we can't easily parse out the useEffects with regex, we can just disable their setters
    # by replacing setAcadPrograms with a no-op, or just leaving it since it won't exist.
    # Wait, if we replace the useState, `setAcadPrograms` will be undefined and cause a build error.
    content = re.sub(r'setAcadPrograms\([^)]*\);?', '', content)
    content = re.sub(r'setAcadCourses\([^)]*\);?', '', content)
    content = re.sub(r'setAcadModules\([^)]*\);?', '', content)
    content = re.sub(r'setAcadInstructors\([^)]*\);?', '', content)
    content = re.sub(r'setAcadTenantTeachers\([^)]*\);?', '', content)
    content = re.sub(r'setAcadLookups\([^)]*\);?', '', content)

    # We also need to remove the big useEffect blocks if possible, or we can just leave them as dead code 
    # that doesn't do anything because we removed the setters.
    # Wait, the useEffect blocks might still set `error` and `loading`. It's better to remove them.
    # I'll manually replace them or let the script try.

    with open('src/app/admin/admin-panel.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    main()
