from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsServiceOwnerOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_authenticated and obj.owner_id == request.user.id
